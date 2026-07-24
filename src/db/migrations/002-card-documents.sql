-- File: src/db/migrations/002-card-documents.sql
CREATE TABLE IF NOT EXISTS card_document (
  card_id     TEXT NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  linked_at   TEXT NOT NULL,
  PRIMARY KEY (card_id, document_id)
);
