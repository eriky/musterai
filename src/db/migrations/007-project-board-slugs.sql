-- Human-readable, stable URL segments for projects and boards.
-- Existing rows are populated by Migrator.backfillSlugs() after all migrations
-- have run, because collision suffixes require a deterministic ordered pass.
ALTER TABLE project ADD COLUMN slug TEXT;
ALTER TABLE board ADD COLUMN slug TEXT;
