-- File: src/db/migrations/007-card-links.sql
CREATE TABLE IF NOT EXISTS card_link (
  id              TEXT PRIMARY KEY,
  source_card_id  TEXT NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  target_card_id  TEXT NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  relation_type   TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  UNIQUE (source_card_id, target_card_id, relation_type)
);
