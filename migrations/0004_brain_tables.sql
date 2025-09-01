-- Migration: Add brain tables for entity normalization and intent candidates
-- Purpose: Support AI agent brain functionality for Home Assistant entities

-- Table to store entity normalization data
CREATE TABLE IF NOT EXISTS entity_normalization (
    entity_id TEXT PRIMARY KEY,
    canonical_type TEXT NOT NULL,
    canonical_domain TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.0,
    reasoning TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table to store intent candidates for each entity
CREATE TABLE IF NOT EXISTS intent_candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id TEXT NOT NULL,
    label TEXT NOT NULL,
    intent_kind TEXT NOT NULL CHECK (intent_kind IN ('control', 'schedule', 'query', 'diagnostic')),
    action_domain TEXT NOT NULL,
    action_service TEXT NOT NULL,
    action_data_json TEXT,
    requires_caps TEXT, -- JSON array of required capabilities
    confidence REAL DEFAULT 0.75,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

-- Table to store entity capabilities
CREATE TABLE IF NOT EXISTS entity_capabilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id TEXT NOT NULL,
    name TEXT NOT NULL,
    value_text TEXT,
    value_num REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
    UNIQUE(entity_id, name)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_intent_candidates_entity_id ON intent_candidates(entity_id);
CREATE INDEX IF NOT EXISTS idx_intent_candidates_enabled ON intent_candidates(enabled);
CREATE INDEX IF NOT EXISTS idx_entity_capabilities_entity_id ON entity_capabilities(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_normalization_canonical_type ON entity_normalization(canonical_type);
