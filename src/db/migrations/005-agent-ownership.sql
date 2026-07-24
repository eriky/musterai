-- File: src/db/migrations/005-agent-ownership.sql
-- Add human secret token system settings and agent owner tracking

CREATE TABLE IF NOT EXISTS system_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  created_at TEXT NOT NULL
);

ALTER TABLE agent_registration ADD COLUMN owner_id TEXT;
ALTER TABLE agent_registration ADD COLUMN secret_token TEXT;
