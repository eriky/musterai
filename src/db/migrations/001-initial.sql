-- File: src/db/migrations/001-initial.sql
--
-- Squashed schema (was migrations 001–011). Muster is 2.0.0-alpha with a
-- single operator — no backward compatibility to preserve. See design
-- document §11 for the rationale.
--
-- The identity core uses a principal supertable so that card_assignee,
-- comment, document, event, kb_fact and card.claimed_by each point at a
-- real foreign key rather than a polymorphic (type, id) pair.

-- ============================================================
-- Identity & access control
-- ============================================================

CREATE TABLE IF NOT EXISTS workspace (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_slug ON workspace(slug);

CREATE TABLE IF NOT EXISTS principal (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('user','agent')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_user (
  id           TEXT PRIMARY KEY REFERENCES principal(id) ON DELETE CASCADE,
  email        TEXT,
  display_name TEXT NOT NULL,
  avatar_url   TEXT,
  status       TEXT NOT NULL DEFAULT 'active',
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identity (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  provider  TEXT NOT NULL,
  subject   TEXT NOT NULL,
  email     TEXT,
  UNIQUE(provider, subject)
);

CREATE TABLE IF NOT EXISTS role (
  id               TEXT PRIMARY KEY,
  workspace_id     TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  key              TEXT NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  permissions_json TEXT NOT NULL DEFAULT '[]',
  is_system        INTEGER NOT NULL DEFAULT 0,
  rank             INTEGER NOT NULL DEFAULT 0,
  UNIQUE(workspace_id, key)
);

CREATE TABLE IF NOT EXISTS workspace_member (
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  role_id      TEXT NOT NULL REFERENCES role(id) ON DELETE RESTRICT,
  joined_at    TEXT NOT NULL,
  invited_by   TEXT REFERENCES app_user(id) ON DELETE SET NULL,
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS invitation (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  role_id      TEXT NOT NULL REFERENCES role(id) ON DELETE RESTRICT,
  token_hash   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  accepted_at  TEXT,
  created_by   TEXT REFERENCES app_user(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Single-use, short-lived record of an in-flight OIDC authorization request.
-- Holds the values that must be validated on callback (state/nonce/PKCE) and
-- an optional post-login redirect target. Deleted once consumed.
CREATE TABLE IF NOT EXISTS oidc_transaction (
  state          TEXT PRIMARY KEY,
  nonce          TEXT NOT NULL,
  pkce_verifier  TEXT NOT NULL,
  redirect_to    TEXT,
  created_at     TEXT NOT NULL,
  expires_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  last_seen_at TEXT,
  user_agent   TEXT,
  ip           TEXT,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_token (
  id            TEXT PRIMARY KEY,
  principal_id  TEXT NOT NULL REFERENCES principal(id) ON DELETE CASCADE,
  workspace_id  TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  token_hash    TEXT NOT NULL,
  prefix        TEXT NOT NULL,
  expires_at    TEXT,
  revoked_at    TEXT,
  last_used_at  TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  actor_id    TEXT REFERENCES principal(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  payload     TEXT,
  ip          TEXT,
  created_at  TEXT NOT NULL
);

-- ============================================================
-- Agent registry (bound to a principal, no type discriminator)
-- ============================================================

CREATE TABLE IF NOT EXISTS agent (
  id              TEXT PRIMARY KEY REFERENCES principal(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  capabilities    TEXT,
  status          TEXT NOT NULL DEFAULT 'active',
  last_seen_at    TEXT NOT NULL,
  operator_user_id TEXT REFERENCES app_user(id) ON DELETE SET NULL,
  role_id         TEXT REFERENCES role(id) ON DELETE SET NULL,
  workspace_id    TEXT REFERENCES workspace(id) ON DELETE CASCADE,
  created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_operator ON agent(operator_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_workspace ON agent(workspace_id);

-- ============================================================
-- Projects & Boards (workspace-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS project (
  id          TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  key_prefix  TEXT,
  card_seq    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_workspace ON project(workspace_id);

CREATE TABLE IF NOT EXISTS board (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "column" (
  id        TEXT PRIMARY KEY,
  board_id  TEXT NOT NULL REFERENCES board(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  position  TEXT NOT NULL,
  wip_limit INTEGER
);

-- ============================================================
-- Cards
-- ============================================================

CREATE TABLE IF NOT EXISTS card (
  id               TEXT PRIMARY KEY,
  key              TEXT,
  column_id        TEXT NOT NULL REFERENCES "column"(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  position         TEXT NOT NULL,
  priority         TEXT NOT NULL DEFAULT 'medium',
  due_date         TEXT,
  status           TEXT NOT NULL DEFAULT 'active',
  blocked_reason   TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  archived         INTEGER NOT NULL DEFAULT 0,
  claimed_by       TEXT REFERENCES principal(id) ON DELETE SET NULL,
  claimed_at       TEXT,
  claim_expires_at TEXT,
  is_epic          INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_card_key ON card(key);

CREATE TABLE IF NOT EXISTS card_assignee (
  card_id      TEXT NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  principal_id TEXT NOT NULL REFERENCES principal(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, principal_id)
);

CREATE TABLE IF NOT EXISTS card_label (
  card_id  TEXT NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  label_id TEXT NOT NULL REFERENCES label(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, label_id)
);

CREATE TABLE IF NOT EXISTS card_link (
  id              TEXT PRIMARY KEY,
  source_card_id  TEXT NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  target_card_id  TEXT NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  relation_type   TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  UNIQUE (source_card_id, target_card_id, relation_type)
);

CREATE TABLE IF NOT EXISTS card_work_link (
  id           TEXT PRIMARY KEY,
  card_id      TEXT NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,
  provider     TEXT NOT NULL,
  url          TEXT NOT NULL,
  external_ref TEXT,
  title        TEXT,
  status       TEXT,
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_card_work_link_card_id ON card_work_link(card_id);

CREATE TABLE IF NOT EXISTS card_document (
  card_id     TEXT NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  linked_at   TEXT NOT NULL,
  PRIMARY KEY (card_id, document_id)
);

-- ============================================================
-- Comments
-- ============================================================

CREATE TABLE IF NOT EXISTS comment (
  id         TEXT PRIMARY KEY,
  card_id    TEXT NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES principal(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ============================================================
-- Labels
-- ============================================================

CREATE TABLE IF NOT EXISTS label (
  id       TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES board(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  color    TEXT NOT NULL
);

-- ============================================================
-- Documents
-- ============================================================

CREATE TABLE IF NOT EXISTS document (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  parent_id  TEXT REFERENCES document(id) ON DELETE SET NULL,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'draft',
  author_id  TEXT REFERENCES principal(id) ON DELETE SET NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_version (
  id             TEXT PRIMARY KEY,
  document_id    TEXT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  version        INTEGER NOT NULL,
  title          TEXT NOT NULL,
  content        TEXT NOT NULL,
  author_id      TEXT REFERENCES principal(id) ON DELETE SET NULL,
  change_summary TEXT,
  created_at     TEXT NOT NULL
);

-- ============================================================
-- Attachments
-- ============================================================

CREATE TABLE IF NOT EXISTS attachment (
  id         TEXT PRIMARY KEY,
  card_id    TEXT NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  filename   TEXT NOT NULL,
  path       TEXT NOT NULL,
  mime_type  TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- ============================================================
-- Events (collaboration feed)
-- ============================================================

CREATE TABLE IF NOT EXISTS event (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  action      TEXT NOT NULL,
  actor_id    TEXT REFERENCES principal(id) ON DELETE SET NULL,
  payload     TEXT,
  created_at  TEXT NOT NULL
);

-- ============================================================
-- Knowledge Base
-- ============================================================

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
  id         TEXT PRIMARY KEY,
  kb_id      TEXT NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'custom',
  identifier TEXT,
  metadata   TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kb_entity_kb_id ON kb_entity(kb_id);
CREATE INDEX IF NOT EXISTS idx_kb_entity_identifier ON kb_entity(identifier);
CREATE INDEX IF NOT EXISTS idx_kb_entity_type ON kb_entity(type);

CREATE TABLE IF NOT EXISTS kb_fact (
  id                TEXT PRIMARY KEY,
  kb_id             TEXT NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
  entity_id         TEXT REFERENCES kb_entity(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  content           TEXT NOT NULL,
  category          TEXT NOT NULL DEFAULT 'general',
  confidence        REAL DEFAULT 1.0,
  source_principal_id TEXT REFERENCES principal(id) ON DELETE SET NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kb_fact_kb_id ON kb_fact(kb_id);
CREATE INDEX IF NOT EXISTS idx_kb_fact_entity_id ON kb_fact(entity_id);

CREATE TABLE IF NOT EXISTS kb_relation (
  id               TEXT PRIMARY KEY,
  kb_id            TEXT NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
  source_entity_id TEXT NOT NULL REFERENCES kb_entity(id) ON DELETE CASCADE,
  target_entity_id TEXT NOT NULL REFERENCES kb_entity(id) ON DELETE CASCADE,
  relation_type    TEXT NOT NULL,
  description      TEXT,
  created_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kb_relation_source ON kb_relation(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_kb_relation_target ON kb_relation(target_entity_id);