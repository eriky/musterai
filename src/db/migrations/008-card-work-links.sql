-- File: src/db/migrations/008-card-work-links.sql
CREATE TABLE IF NOT EXISTS card_work_link (
  id            TEXT PRIMARY KEY,
  card_id       TEXT NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  provider      TEXT NOT NULL,
  url           TEXT NOT NULL,
  external_ref  TEXT,
  title         TEXT,
  status        TEXT,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_card_work_link_card_id ON card_work_link(card_id);
