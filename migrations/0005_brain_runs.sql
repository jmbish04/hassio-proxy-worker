-- Migration: Add brain runs tracking table
-- Purpose: Track when brain sweeps are executed to show last run time

CREATE TABLE IF NOT EXISTS brain_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ran_at_utc DATETIME NOT NULL,
    scanned INTEGER NOT NULL DEFAULT 0,
    normalized INTEGER NOT NULL DEFAULT 0,
    intents_created INTEGER NOT NULL DEFAULT 0,
    entities_synced INTEGER DEFAULT 0,
    sync_errors INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_brain_runs_ran_at ON brain_runs(ran_at_utc DESC);
