/**
 * Home Assistant Agent Brain
 *
 * Responsible for normalizing entities and generating intent candidates
 * so that user-facing agents can interact naturally with Home Assistant.
 */

import { logger } from './logger';

export interface UnbrainedEntity {
  id: string;
  domain: string;
  object_id: string;
  friendly_name: string | null;
}

export interface IntentCandidate {
  label: string;
  intent_kind: "control" | "schedule" | "query" | "diagnostic";
  action_domain: string;
  action_service: string;
  action_data: Record<string, unknown>;
  requires_caps?: string[];
  confidence?: number;
}

export interface BrainSweepResult {
  ran_at_utc: string;
  scanned: number;
  normalized: number;
  intentsCreated: number;
}

/**
 * Main brain sweep function - processes unbrained entities
 */
export async function brainSweep(db: D1Database): Promise<BrainSweepResult> {
	logger.info("🧠 Brain sweep starting...");

	// 1) Find entities with NO normalization or NO enabled intents
	const unbrained = await selectUnbrainedEntities(db);
	logger.debug(`Found ${unbrained.length} unbrained entities`);

	// 2) Process each entity: ensure normalization + intents
	let normalized = 0;
	let intentsCreated = 0;

	for (const entity of unbrained) {
		try {
			const normed = await upsertNormalization(db, entity);
			if (normed) normalized++;

			const added = await ensureIntents(db, entity);
			intentsCreated += added;

			logger.debug(`Processed ${entity.id}: normalized=${normed}, intents_added=${added}`);
		} catch (error) {
			logger.error(`Failed to process entity ${entity.id}:`, error);
		}
	}

	const result = {
		ran_at_utc: new Date().toISOString(),
		scanned: unbrained.length,
		normalized,
		intentsCreated,
	};

	// Record the brain run in the database
	try {
		await db.prepare(`
			INSERT INTO brain_runs (ran_at_utc, scanned, normalized, intents_created)
			VALUES (?, ?, ?, ?)
		`).bind(result.ran_at_utc, result.scanned, result.normalized, result.intentsCreated).run();
		logger.debug("Brain run recorded to database");
	} catch (error) {
		logger.error("Failed to record brain run:", error);
	}

	logger.info(`🧠 Brain sweep complete:`, result);
	return result;
}

/**
 * Find entities that need normalization or intent generation
 */
async function selectUnbrainedEntities(db: D1Database): Promise<UnbrainedEntity[]> {
  const sql = `
    SELECT e.id, e.domain, e.object_id, e.friendly_name
    FROM entities e
    LEFT JOIN entity_normalization n ON n.entity_id = e.id
    LEFT JOIN intent_candidates i ON i.entity_id = e.id AND i.enabled = 1
    GROUP BY e.id, e.domain, e.object_id, e.friendly_name
    HAVING n.entity_id IS NULL OR COUNT(i.id) < 5
  `;

  const res = await db.prepare(sql).all<UnbrainedEntity>();
  return res.results ?? [];
}

/**
 * Upsert entity normalization record
 */
async function upsertNormalization(db: D1Database, entity: UnbrainedEntity): Promise<boolean> {
  // Heuristic: treat "switch.*" that looks like a light as conceptual light
  // (but KEEP domain=switch for HA calls)
  const name = (entity.friendly_name ?? entity.object_id).toLowerCase();
  const looksLikeLight = entity.domain === "switch" && /(light|lamp|bulb)/.test(name);
  const looksLikeFan = entity.domain === "switch" && /(fan|ventilation)/.test(name);

  let canonical_type = entity.domain;
  let confidence = 0.9;
  let reasoning = "Default canonicalization equals HA domain.";

  if (looksLikeLight) {
    canonical_type = "light";
    confidence = 0.95;
    reasoning = "Name heuristic indicates a light; HA domain must remain 'switch' for service calls.";
  } else if (looksLikeFan) {
    canonical_type = "fan";
    confidence = 0.9;
    reasoning = "Name heuristic indicates a fan; HA domain must remain 'switch' for service calls.";
  }

  const canonical_domain = entity.domain; // keep actual HA domain for service calls

  const upsert = `
    INSERT INTO entity_normalization (entity_id, canonical_type, canonical_domain, confidence, reasoning)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(entity_id) DO UPDATE SET
      canonical_type=excluded.canonical_type,
      canonical_domain=excluded.canonical_domain,
      confidence=excluded.confidence,
      reasoning=excluded.reasoning,
      updated_at=CURRENT_TIMESTAMP
  `;

  try {
    const result = await db.prepare(upsert).bind(
      entity.id,
      canonical_type,
      canonical_domain,
      confidence,
      reasoning
    ).run();
    return result.success === true;
  } catch (error) {
    logger.error(`Failed to upsert normalization for ${entity.id}:`, error);
    return false;
  }
}

/**
 * Ensure entity has sufficient intent candidates (minimum 5)
 */
async function ensureIntents(db: D1Database, entity: UnbrainedEntity): Promise<number> {
  // Don't duplicate if we already have >=5 intents
  const countRes = await db
    .prepare(`SELECT COUNT(*) AS c FROM intent_candidates WHERE entity_id=? AND enabled=1`)
    .bind(entity.id)
    .first<{ c: number }>();

  if ((countRes?.c ?? 0) >= 5) {
    logger.debug(`Entity ${entity.id} already has ${countRes?.c} intents, skipping`);
    return 0;
  }

  // Look up basic capabilities if present
  const caps = await loadEntityCapabilities(db, entity.id);
  const intents = generateIntents(entity, caps);

  let created = 0;
  const insert = `
    INSERT INTO intent_candidates
      (entity_id, label, intent_kind, action_domain, action_service, action_data_json, requires_caps, confidence, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `;

  for (const intent of intents) {
    try {
      await db.prepare(insert).bind(
        entity.id,
        intent.label,
        intent.intent_kind,
        intent.action_domain,
        intent.action_service,
        JSON.stringify(intent.action_data),
        intent.requires_caps?.length ? JSON.stringify(intent.requires_caps) : null,
        intent.confidence ?? 0.75
      ).run();
      created++;
    } catch (error) {
      logger.error(`Failed to insert intent for ${entity.id}:`, error);
    }
  }

  return created;
}

/**
 * Load entity capabilities from database
 */
async function loadEntityCapabilities(db: D1Database, entityId: string): Promise<Record<string, string | number | boolean>> {
  try {
    const rows = await db
      .prepare(`SELECT name, COALESCE(value_text, CAST(value_num AS TEXT)) AS v FROM entity_capabilities WHERE entity_id=?`)
      .bind(entityId)
      .all<{ name: string; v: string }>();

    const caps: Record<string, string | number | boolean> = {};
    for (const row of rows.results ?? []) {
      // Parse bool/num if obvious
      if (row.v === "true" || row.v === "false") {
        caps[row.name] = row.v === "true";
      } else if (!Number.isNaN(Number(row.v))) {
        caps[row.name] = Number(row.v);
      } else {
        caps[row.name] = row.v;
      }
    }
    return caps;
  } catch (error) {
    logger.error(`Failed to load capabilities for ${entityId}:`, error);
    return {};
  }
}

/**
 * Generate intent candidates for an entity based on its domain and capabilities
 */
function generateIntents(
  entity: UnbrainedEntity,
  caps: Record<string, string | number | boolean>
): IntentCandidate[] {
  const labelName = entity.friendly_name ?? entity.object_id.replace(/_/g, " ");
  const entityId = entity.id;
  const intents: IntentCandidate[] = [];

  const add = (
    label: string,
    kind: "control" | "schedule" | "query" | "diagnostic",
    service: string,
    data: Record<string, unknown>,
    requires_caps?: string[],
    confidence = 0.8
  ) => {
    intents.push({
      label,
      intent_kind: kind,
      action_domain: entity.domain, // always keep actual HA domain
      action_service: service,
      action_data: { entity_id: entityId, ...data },
      requires_caps,
      confidence
    });
  };

  // Generate domain-specific intents
  switch (entity.domain) {
    case "switch":
      add(`turn on ${labelName}`, "control", "turn_on", {});
      add(`turn off ${labelName}`, "control", "turn_off", {});
      add(`toggle ${labelName}`, "control", "toggle", {});
      add(`turn off ${labelName} in 15 minutes`, "schedule", "turn_off", { delay: "PT15M" }, undefined, 0.75);
      add(`turn on ${labelName} at dusk daily`, "schedule", "turn_on", { schedule: "sunset_daily" }, undefined, 0.72);
      add(`check ${labelName} status`, "query", "get_state", {}, undefined, 0.7);
      break;

    case "light":
      add(`turn on ${labelName}`, "control", "turn_on", {});
      add(`turn off ${labelName}`, "control", "turn_off", {});
      add(`toggle ${labelName}`, "control", "toggle", {});

      if (caps.supports_brightness) {
        add(`dim ${labelName} to 30%`, "control", "turn_on", { brightness_pct: 30 }, ["supports_brightness"]);
        add(`set ${labelName} to 75%`, "control", "turn_on", { brightness_pct: 75 }, ["supports_brightness"]);
        add(`brighten ${labelName}`, "control", "turn_on", { brightness_pct: 100 }, ["supports_brightness"]);
      }

      if (caps.supports_color) {
        add(`set ${labelName} to red`, "control", "turn_on", { color_name: "red" }, ["supports_color"]);
        add(`set ${labelName} to blue`, "control", "turn_on", { color_name: "blue" }, ["supports_color"]);
      }

      add(`turn off ${labelName} in 15 minutes`, "schedule", "turn_off", { delay: "PT15M" }, undefined, 0.75);
      add(`turn on ${labelName} at dusk daily`, "schedule", "turn_on", { schedule: "sunset_daily" }, undefined, 0.72);
      break;

    case "lock":
      add(`lock ${labelName}`, "control", "lock", {});
      add(`unlock ${labelName}`, "control", "unlock", {});
      add(`auto-lock ${labelName} after 5 minutes`, "schedule", "lock", { delay: "PT5M" }, undefined, 0.7);
      add(`check ${labelName} lock status`, "query", "get_state", {}, undefined, 0.8);
      break;

    case "camera":
      add(`show live stream for ${labelName}`, "query", "play_stream", { format: "hls" });
      add(`snapshot ${labelName} now`, "control", "snapshot", { filename: `/tmp/${entity.object_id}_${Date.now()}.jpg` });
      add(`notify me on motion for ${labelName}`, "schedule", "automation_stub", { template: "camera_motion_notify" }, undefined, 0.7);
      add(`record ${labelName} for 30 seconds`, "control", "record", { duration: 30 }, undefined, 0.75);
      add(`check ${labelName} status`, "diagnostic", "get_state", {}, undefined, 0.8);
      break;

    case "sensor":
      add(`check ${labelName} reading`, "query", "get_state", {}, undefined, 0.9);
      add(`show ${labelName} history`, "query", "get_history", { hours: 24 }, undefined, 0.8);
      add(`alert me if ${labelName} exceeds threshold`, "schedule", "automation_stub", { template: "sensor_threshold_alert" }, undefined, 0.7);
      break;

    case "climate":
      add(`set ${labelName} to 72°F`, "control", "set_temperature", { temperature: 72 });
      add(`turn on ${labelName}`, "control", "turn_on", {});
      add(`turn off ${labelName}`, "control", "turn_off", {});
      add(`set ${labelName} to heat mode`, "control", "set_hvac_mode", { hvac_mode: "heat" });
      add(`set ${labelName} to cool mode`, "control", "set_hvac_mode", { hvac_mode: "cool" });
      add(`check ${labelName} temperature`, "query", "get_state", {}, undefined, 0.8);
      break;

    case "fan":
      add(`turn on ${labelName}`, "control", "turn_on", {});
      add(`turn off ${labelName}`, "control", "turn_off", {});
      add(`set ${labelName} speed to low`, "control", "set_percentage", { percentage: 33 });
      add(`set ${labelName} speed to high`, "control", "set_percentage", { percentage: 100 });
      add(`oscillate ${labelName}`, "control", "oscillate", { oscillating: true });
      break;

    case "cover":
      add(`open ${labelName}`, "control", "open_cover", {});
      add(`close ${labelName}`, "control", "close_cover", {});
      add(`stop ${labelName}`, "control", "stop_cover", {});
      add(`set ${labelName} to 50%`, "control", "set_cover_position", { position: 50 });
      add(`check ${labelName} position`, "query", "get_state", {}, undefined, 0.8);
      break;

    default:
      // Generic intents for unknown domains
      add(`turn on ${labelName}`, "control", "turn_on", {}, undefined, 0.6);
      add(`turn off ${labelName}`, "control", "turn_off", {}, undefined, 0.6);
      add(`check ${labelName} status`, "query", "get_state", {}, undefined, 0.7);
      add(`toggle ${labelName}`, "control", "toggle", {}, undefined, 0.5);
      add(`restart ${labelName}`, "diagnostic", "reload", {}, undefined, 0.4);
      break;
  }

  // Ensure we have at least 5 intents but no more than 15
  const minIntents = 5;
  const maxIntents = 15;

  // If we have too few intents, add some generic ones
  while (intents.length < minIntents) {
    const remaining = minIntents - intents.length;
    if (remaining >= 1) add(`activate ${labelName}`, "control", "turn_on", {}, undefined, 0.5);
    if (remaining >= 2) add(`deactivate ${labelName}`, "control", "turn_off", {}, undefined, 0.5);
    if (remaining >= 3) add(`get ${labelName} info`, "diagnostic", "get_state", {}, undefined, 0.6);
    if (remaining >= 4) add(`reset ${labelName}`, "diagnostic", "reload", {}, undefined, 0.4);
    if (remaining >= 5) add(`monitor ${labelName}`, "schedule", "automation_stub", { template: "entity_monitor" }, undefined, 0.5);
    break; // Prevent infinite loop
  }

  // Trim to maximum if we have too many
  return intents.slice(0, maxIntents);
}
