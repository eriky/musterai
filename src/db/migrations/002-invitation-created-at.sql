-- File: src/db/migrations/002-invitation-created-at.sql
--
-- The `invitation.created_at` column was added to 001-initial.sql after
-- some databases already had the table created from an earlier revision of
-- that file. CREATE TABLE IF NOT EXISTS is a no-op against an existing
-- table, so those databases never got the column, and
-- InvitationService.list()'s `ORDER BY created_at` 500s. This is an
-- additive, idempotent fixup — Migrator.run() already tolerates a
-- "duplicate column name" error for the common case where the column
-- already exists (e.g. a database created from 001 after this fix).

ALTER TABLE invitation ADD COLUMN created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
