-- File: src/db/migrations/010-card-keys.sql
-- Human-readable, JIRA-style card keys (e.g. "MUS-42") alongside the
-- existing ULID primary key. key_prefix/card_seq/key are backfilled
-- by Migrator.backfillCardKeys() since deriving a prefix from a name
-- needs logic that plain SQL can't express well.

ALTER TABLE project ADD COLUMN key_prefix TEXT;
ALTER TABLE project ADD COLUMN card_seq INTEGER NOT NULL DEFAULT 0;

ALTER TABLE card ADD COLUMN key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_card_key ON card(key);
