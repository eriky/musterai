-- Migration 008: Card claim lease columns
ALTER TABLE card ADD COLUMN claimed_by TEXT REFERENCES agent_registration(id) ON DELETE SET NULL;
ALTER TABLE card ADD COLUMN claimed_at TEXT;
ALTER TABLE card ADD COLUMN claim_expires_at TEXT;
