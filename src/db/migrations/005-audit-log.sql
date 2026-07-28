-- File: src/db/migrations/005-audit-log.sql
--
-- audit_log already exists (001-initial.sql predates any writer for it —
-- MUS-30 is the first card that actually populates it) but lacks
-- actor_kind, which the audit records need to render a principal chip
-- without a second lookup. Additive, idempotent — Migrator.run() already
-- tolerates "duplicate column name" for a database created after this
-- fix was folded into 001.

ALTER TABLE audit_log ADD COLUMN actor_kind TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_log_workspace ON audit_log(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id);
