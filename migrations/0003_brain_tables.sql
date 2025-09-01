PRAGMA foreign_keys = ON;

-- =========================================================
-- HARD RESET of placeholder tables (safe if you accept data loss)
-- =========================================================
DROP VIEW  IF EXISTS vw_cameras_entities;
DROP VIEW  IF EXISTS vw_intent_suggestions;
DROP VIEW  IF EXISTS vw_entities_enriched;
DROP VIEW  IF EXISTS vw_entity_latest_state;

DROP TABLE IF EXISTS cameras;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS log_diagnostics;

-- Keep dropping brain tables too (idempotent full reset)
DROP TABLE IF EXISTS knowledge;
DROP TABLE IF EXISTS automations;
DROP TABLE IF EXISTS action_queue;
DROP TABLE IF EXISTS intent_candidates;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS service_domains;
DROP TABLE IF EXISTS entity_embeddings;
DROP TABLE IF EXISTS entity_synonyms;
DROP TABLE IF EXISTS entity_normalization;
DROP TABLE IF EXISTS entity_capabilities;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS states;
DROP TABLE IF EXISTS entity_attributes;
DROP TABLE IF EXISTS entities;
DROP TABLE IF EXISTS sources;

-- =========================================================
-- CORE: Instances / Sources
-- =========================================================
CREATE TABLE sources (
  id               TEXT PRIMARY KEY,               -- e.g. "default"
  kind             TEXT NOT NULL,                  -- 'home_assistant'
  base_ws_url      TEXT,                           -- wss://<sub>.ui.nabu.casa/api/websocket
  ha_url_hint      TEXT,                           -- optional local URL
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- DEVICES (expanded)
-- =========================================================
CREATE TABLE devices (
  id               TEXT PRIMARY KEY,               -- HA device_id or stable synthetic
  source_id        TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  mac              TEXT,                           -- canonical MAC if known
  ip               TEXT,                           -- last known IP
  hostname         TEXT,                           -- DNS / mDNS name
  manufacturer     TEXT,
  model            TEXT,
  hw_version       TEXT,
  sw_version       TEXT,
  area             TEXT,                           -- HA area or freeform
  name             TEXT,                           -- device friendly name
  via_device       TEXT,                           -- bridge/parent
  is_online        INTEGER DEFAULT 1,
  seen_at          DATETIME,                       -- last heartbeat we observed
  metadata_json    TEXT,                           -- freeform extras (JSON)
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_devices_mac ON devices(mac);
CREATE INDEX        idx_devices_source ON devices(source_id);
CREATE INDEX        idx_devices_area   ON devices(area);

-- =========================================================
-- ENTITIES (core registry)
-- =========================================================
CREATE TABLE entities (
  id               TEXT PRIMARY KEY,               -- 'switch.bathroom_light'
  source_id        TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  device_id        TEXT REFERENCES devices(id) ON DELETE SET NULL,
  domain           TEXT NOT NULL,                  -- 'switch','light','camera',...
  object_id        TEXT NOT NULL,                  -- 'bathroom_light'
  friendly_name    TEXT,
  icon             TEXT,
  unit_of_measure  TEXT,
  area             TEXT,
  is_enabled       INTEGER NOT NULL DEFAULT 1,
  first_seen_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at     DATETIME,
  metadata_json    TEXT,                           -- HA registry fields, unique_id, etc.
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_entities_source ON entities(source_id);
CREATE INDEX idx_entities_domain ON entities(domain);
CREATE INDEX idx_entities_area   ON entities(area);

-- =========================================================
-- CAMERA DETAILS (expanded; Protect-specific & streaming hints)
-- =========================================================
CREATE TABLE cameras (
  id               TEXT PRIMARY KEY,               -- stable camera row id (can mirror entities.id or protect_id)
  source_id        TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  device_id        TEXT REFERENCES devices(id) ON DELETE SET NULL,
  entity_id        TEXT REFERENCES entities(id) ON DELETE SET NULL,  -- 'camera.xxx' if mapped
  protect_id       TEXT UNIQUE,                    -- UniFi Protect camera UUID
  name             TEXT,                           -- display name
  is_online        INTEGER,
  last_seen_ts     DATETIME,
  rtsp_enabled     INTEGER,                        -- 0/1
  has_speaker      INTEGER,                        -- 0/1
  has_mic          INTEGER,                        -- 0/1
  has_package_cam  INTEGER,                        -- 0/1 (e.g., G4 Doorbell Pro package camera)
  resolution_json  TEXT,                           -- JSON list of streams (res/fps/rtsp urls)
  location_area    TEXT,                           -- textual area/zone
  diagnostics_json TEXT,                           -- disk/codec/errors
  metadata_json    TEXT,                           -- anything else (lens, fov, firmware, channel ids)
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cameras_source     ON cameras(source_id);
CREATE INDEX idx_cameras_device     ON cameras(device_id);
CREATE INDEX idx_cameras_entity     ON cameras(entity_id);
CREATE INDEX idx_cameras_last_seen  ON cameras(last_seen_ts);

-- =========================================================
-- ENTITY ATTRIBUTES / CAPABILITIES
-- =========================================================
CREATE TABLE entity_attributes (
  entity_id        TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  ts               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  attributes_json  TEXT NOT NULL,
  PRIMARY KEY(entity_id, ts)
);
CREATE INDEX idx_entity_attributes_ts ON entity_attributes(entity_id, ts DESC);

CREATE TABLE entity_capabilities (
  entity_id        TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,                  -- e.g., supports_brightness
  value_text       TEXT,
  value_num        REAL,
  source_reason    TEXT,                           -- 'service_schema','attributes','observed'
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (entity_id, name)
);
CREATE INDEX idx_entity_caps_name ON entity_capabilities(name);

-- =========================================================
-- NORMALIZATION / NLU
-- =========================================================
CREATE TABLE entity_normalization (
  entity_id        TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  canonical_type   TEXT NOT NULL,                  -- conceptual type ('light','switch',...)
  canonical_domain TEXT NOT NULL,                  -- **actual** domain for HA service calls
  confidence       REAL NOT NULL DEFAULT 0.80,
  reasoning        TEXT,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE entity_synonyms (
  entity_id        TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  synonym          TEXT NOT NULL,                  -- "bathroom light", "ensuite light"
  kind             TEXT DEFAULT 'human',           -- 'human','model','imported'
  confidence       REAL DEFAULT 0.8,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (entity_id, synonym)
);

CREATE TABLE entity_embeddings (
  entity_id        TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  model            TEXT NOT NULL,
  vector           BLOB NOT NULL,                  -- raw bytes; store JSON if you prefer
  dims             INTEGER NOT NULL,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- STATES / EVENTS
-- =========================================================
CREATE TABLE states (
  entity_id        TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  ts               DATETIME NOT NULL,
  state            TEXT NOT NULL,
  attributes_json  TEXT,
  origin_event_id  TEXT,                           -- link to events.id
  PRIMARY KEY (entity_id, ts)
);
CREATE INDEX idx_states_ts ON states(entity_id, ts DESC);

CREATE TABLE events (
  id               TEXT PRIMARY KEY,               -- HA event id or UUID
  source_id        TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL,                  -- 'state_changed','call_service',...
  entity_id        TEXT,                           -- nullable
  ts               DATETIME NOT NULL,
  payload_json     TEXT NOT NULL
);
CREATE INDEX idx_events_type_ts  ON events(event_type, ts DESC);
CREATE INDEX idx_events_entity_ts ON events(entity_id, ts DESC);

-- =========================================================
-- SERVICE CATALOG
-- =========================================================
CREATE TABLE service_domains (
  domain           TEXT PRIMARY KEY,               -- 'switch','light','unifiprotect',...
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE services (
  domain           TEXT NOT NULL REFERENCES service_domains(domain) ON DELETE CASCADE,
  service          TEXT NOT NULL,                  -- 'turn_on','turn_off','toggle',...
  fields_schema    TEXT,                           -- JSON schema from /api/services
  description      TEXT,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (domain, service)
);

-- =========================================================
-- INTENTS / ACTIONS / AUTOMATIONS / KNOWLEDGE
-- =========================================================
CREATE TABLE intent_candidates (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id        TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  label            TEXT NOT NULL,                  -- "turn on bathroom light"
  intent_kind      TEXT NOT NULL,                  -- 'control','schedule','query','diagnostic'
  action_domain    TEXT NOT NULL,                  -- actual HA domain to call
  action_service   TEXT NOT NULL,                  -- service name
  action_data_json TEXT,                           -- final/templated payload
  requires_caps    TEXT,                           -- CSV/JSON of caps
  confidence       REAL DEFAULT 0.7,
  enabled          INTEGER DEFAULT 1,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_intents_entity ON intent_candidates(entity_id);

CREATE TABLE action_queue (
  id               TEXT PRIMARY KEY,               -- UUID
  source_id        TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  requested_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  requested_by     TEXT,                           -- 'system','user:<id>','automation:<id>'
  intent_id        INTEGER REFERENCES intent_candidates(id) ON DELETE SET NULL,
  entity_id        TEXT REFERENCES entities(id) ON DELETE SET NULL,
  domain           TEXT NOT NULL,                  -- HA domain
  service          TEXT NOT NULL,                  -- HA service
  service_data_json TEXT,                          -- resolved payload
  status           TEXT NOT NULL DEFAULT 'queued', -- 'queued','sent','acked','failed'
  last_error       TEXT,
  sent_at          DATETIME,
  acked_at         DATETIME,
  result_event_id  TEXT REFERENCES events(id) ON DELETE SET NULL
);
CREATE INDEX idx_actionqueue_status ON action_queue(status);
CREATE INDEX idx_actionqueue_entity ON action_queue(entity_id);

CREATE TABLE automations (
  id               TEXT PRIMARY KEY,               -- UUID
  name             TEXT NOT NULL,
  description      TEXT,
  source_id        TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  yaml             TEXT NOT NULL,                  -- HA automation YAML
  status           TEXT NOT NULL DEFAULT 'draft',  -- 'draft','submitted','active','disabled'
  created_by       TEXT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE knowledge (
  id               TEXT PRIMARY KEY,               -- UUID
  scope_kind       TEXT NOT NULL,                  -- 'global','device','entity'
  scope_id         TEXT,                           -- device_id or entity_id when scoped
  title            TEXT,
  content_md       TEXT NOT NULL,                  -- Markdown knowledge
  tags             TEXT,                           -- CSV/JSON tags
  created_by       TEXT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- LOG DIAGNOSTICS (expanded)
-- =========================================================
CREATE TABLE log_diagnostics (
  id               TEXT PRIMARY KEY,               -- UUID
  source_id        TEXT REFERENCES sources(id) ON DELETE SET NULL,
  log_key          TEXT NOT NULL,                  -- file/topic/stream id
  analysis         TEXT,                           -- LLM or rules output
  severity         TEXT,                           -- 'info','warn','error','critical'
  meta_json        TEXT,                           -- JSON with offsets, file path, etc.
  tags             TEXT,                           -- CSV/JSON labels (e.g., 'protect,ffmpeg,stream')
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_logs_key ON log_diagnostics(log_key);
CREATE INDEX idx_logs_created ON log_diagnostics(created_at);

-- =========================================================
-- VIEWS
-- =========================================================
CREATE VIEW vw_entity_latest_state AS
SELECT
  e.id AS entity_id,
  e.domain,
  e.object_id,
  e.friendly_name,
  e.area,
  s.state,
  s.attributes_json,
  s.ts AS last_state_ts
FROM entities e
LEFT JOIN (
  SELECT s1.entity_id, s1.state, s1.attributes_json, s1.ts
  FROM states s1
  JOIN (SELECT entity_id, MAX(ts) AS max_ts FROM states GROUP BY entity_id) m
    ON m.entity_id = s1.entity_id AND m.max_ts = s1.ts
) s ON s.entity_id = e.id;

CREATE VIEW vw_entities_enriched AS
SELECT
  e.id AS entity_id,
  e.domain,
  e.object_id,
  e.friendly_name,
  COALESCE(n.canonical_type, e.domain)   AS canonical_type,
  COALESCE(n.canonical_domain, e.domain) AS canonical_domain,
  n.confidence                            AS normalization_conf,
  l.state                                 AS last_state,
  l.last_state_ts,
  (SELECT json_group_array(json_object('name',c.name,'text',c.value_text,'num',c.value_num))
     FROM entity_capabilities c WHERE c.entity_id = e.id)      AS caps_json,
  (SELECT json_group_array(syn.synonym)
     FROM entity_synonyms syn WHERE syn.entity_id = e.id)      AS synonyms_json
FROM entities e
LEFT JOIN entity_normalization n ON n.entity_id = e.id
LEFT JOIN vw_entity_latest_state l ON l.entity_id = e.id;

CREATE VIEW vw_intent_suggestions AS
SELECT
  i.id AS intent_id,
  i.entity_id,
  e.friendly_name,
  i.label,
  i.intent_kind,
  i.action_domain,
  i.action_service,
  i.action_data_json,
  i.requires_caps,
  i.confidence,
  i.enabled,
  i.created_at
FROM intent_candidates i
JOIN entities e ON e.id = i.entity_id
ORDER BY i.entity_id, i.confidence DESC;

-- =========================================================
-- SEED
-- =========================================================
INSERT OR IGNORE INTO sources (id, kind) VALUES ('default','home_assistant');

-- Minimal service catalog seed; you should sync /api/services at runtime.
INSERT OR IGNORE INTO service_domains(domain) VALUES ('switch'),('light'),('camera'),('automation'),('unifiprotect');
INSERT OR IGNORE INTO services(domain, service, fields_schema, description) VALUES
  ('switch','turn_on','{"entity_id":{"required":true,"type":"string"}}','Turn a switch on'),
  ('switch','turn_off','{"entity_id":{"required":true,"type":"string"}}','Turn a switch off'),
  ('switch','toggle','{"entity_id":{"required":true,"type":"string"}}','Toggle a switch'),
  ('camera','play_stream','{"entity_id":{"required":true,"type":"string"},"format":{"type":"string"}}','Request stream'),
  ('camera','snapshot','{"entity_id":{"required":true,"type":"string"},"filename":{"type":"string"}}','Save snapshot to file');