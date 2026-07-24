-- File: src/db/migrations/003-global-agents.sql
-- Make agents global: remove project_id from agent_registration
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS agent_registration_global (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL,
  role         TEXT NOT NULL,
  capabilities TEXT,
  status       TEXT NOT NULL DEFAULT 'active',
  last_seen_at TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

-- Migrate existing data (dedup: keep newest row per id)
INSERT OR IGNORE INTO agent_registration_global
  SELECT id, name, type, role, capabilities, status, last_seen_at, created_at
  FROM agent_registration;

DROP TABLE agent_registration;
ALTER TABLE agent_registration_global RENAME TO agent_registration;

PRAGMA foreign_keys = ON;
