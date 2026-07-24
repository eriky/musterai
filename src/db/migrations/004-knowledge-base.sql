-- File: src/db/migrations/004-knowledge-base.sql

CREATE TABLE IF NOT EXISTS knowledge_base (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  is_global   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_knowledge_base (
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  kb_id      TEXT NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_id, kb_id)
);

CREATE TABLE IF NOT EXISTS kb_entity (
  id          TEXT PRIMARY KEY,
  kb_id       TEXT NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'custom',
  identifier  TEXT,
  metadata    TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kb_fact (
  id              TEXT PRIMARY KEY,
  kb_id           TEXT NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
  entity_id       TEXT REFERENCES kb_entity(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'general',
  confidence      REAL DEFAULT 1.0,
  source_agent_id TEXT REFERENCES agent_registration(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kb_relation (
  id               TEXT PRIMARY KEY,
  kb_id            TEXT NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
  source_entity_id TEXT NOT NULL REFERENCES kb_entity(id) ON DELETE CASCADE,
  target_entity_id TEXT NOT NULL REFERENCES kb_entity(id) ON DELETE CASCADE,
  relation_type    TEXT NOT NULL,
  description      TEXT,
  created_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kb_entity_kb_id ON kb_entity(kb_id);
CREATE INDEX IF NOT EXISTS idx_kb_entity_identifier ON kb_entity(identifier);
CREATE INDEX IF NOT EXISTS idx_kb_entity_type ON kb_entity(type);
CREATE INDEX IF NOT EXISTS idx_kb_fact_kb_id ON kb_fact(kb_id);
CREATE INDEX IF NOT EXISTS idx_kb_fact_entity_id ON kb_fact(entity_id);
CREATE INDEX IF NOT EXISTS idx_kb_relation_source ON kb_relation(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_kb_relation_target ON kb_relation(target_entity_id);
