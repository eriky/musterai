-- File: src/db/migrations/006-terminal-columns.sql
-- MUS-34: lets a board owner flag which column(s) count as "done" for Epic
-- progress rollups. Columns are otherwise arbitrary and board-owner-named,
-- so nothing before this could be queried against to compute "6 of 13 done".
ALTER TABLE "column" ADD COLUMN is_terminal INTEGER NOT NULL DEFAULT 0;
