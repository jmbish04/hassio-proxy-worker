-- Store log analyses from Workers AI
CREATE TABLE IF NOT EXISTS log_diagnostics (
  id TEXT PRIMARY KEY,
  log_key TEXT NOT NULL,
  analysis TEXT,
  created_at INTEGER
);
