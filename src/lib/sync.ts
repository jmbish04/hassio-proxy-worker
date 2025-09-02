import { logger } from "./logger";

/**
 * Sync entities from Home Assistant to the local database.
 */
export async function syncEntitiesFromHA(
  db: D1Database,
  hassioEndpoint: string,
  hassioToken: string,
): Promise<{ synced: number; errors: number }> {
  logger.debug("Syncing entities from Home Assistant to database");

  try {
    // Get all entity states from Home Assistant
    const statesRes = await fetch(`${hassioEndpoint}/api/states`, {
      headers: {
        Authorization: `Bearer ${hassioToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!statesRes.ok) {
      throw new Error(`States fetch failed: ${statesRes.status}`);
    }

    const states = await statesRes.json();
    if (!Array.isArray(states)) {
      throw new Error("Invalid states response from Home Assistant");
    }

    // Ensure we have a default source
    await db
      .prepare(
        `INSERT OR IGNORE INTO sources (id, kind, base_ws_url, created_at, updated_at)
         VALUES ('default', 'home_assistant', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      )
      .bind(hassioEndpoint.replace(/^http/, "ws") + "/api/websocket")
      .run();

    let synced = 0;
    let errors = 0;

    // Process each entity state
    for (const state of states) {
      try {
        if (!state.entity_id) continue;

        const [domain, object_id] = state.entity_id.split(".", 2);
        if (!domain || !object_id) continue;

        const friendlyName = state.attributes?.friendly_name || null;
        const icon = state.attributes?.icon || null;
        const unitOfMeasure = state.attributes?.unit_of_measurement || null;
        const area = state.attributes?.area_id || null;

        await db
          .prepare(
            `INSERT OR REPLACE INTO entities (
                id, source_id, domain, object_id, friendly_name, icon,
                unit_of_measure, area, is_enabled, last_seen_at,
                metadata_json, updated_at
             ) VALUES (?, 'default', ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)`,
          )
          .bind(
            state.entity_id,
            domain,
            object_id,
            friendlyName,
            icon,
            unitOfMeasure,
            area,
            JSON.stringify({
              unique_id: state.attributes?.unique_id,
              device_id: state.attributes?.device_id,
              device_class: state.attributes?.device_class,
              entity_category: state.attributes?.entity_category,
            }),
          )
          .run();

        synced++;
      } catch (entityError) {
        logger.error(`Failed to sync entity ${state.entity_id}:`, entityError);
        errors++;
      }
    }

    logger.debug(`Entity sync complete: ${synced} synced, ${errors} errors`);
    return { synced, errors };
  } catch (error) {
    logger.error("Entity sync failed:", error);
    throw error;
  }
}

