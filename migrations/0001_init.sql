-- Placeholder schema to keep future diffs small.
-- Real columns will be added in the next PR.
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  mac TEXT UNIQUE,
  ip TEXT,
  hostname TEXT,
  last_seen_ts INTEGER
);

CREATE TABLE IF NOT EXISTS cameras (
  id TEXT PRIMARY KEY,
  protect_id TEXT UNIQUE,
  name TEXT,
  is_online INTEGER,
  last_seen_ts INTEGER
);
