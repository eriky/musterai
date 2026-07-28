-- File: src/db/migrations/004-mcp-oauth.sql
--
-- MCP-native OAuth (MUS-29) — an MCP client (e.g. `claude mcp add --transport
-- http`) registers itself (RFC 7591), completes Authorization Code + PKCE
-- (OAuth 2.1 draft, per the current MCP Authorization spec), and is issued a
-- token bound to an AGENT principal it never chose itself — the human who
-- approves the consent screen picks the agent identity and role, and the
-- token that comes out is a normal api_token row (design doc §4's
-- effective_permissions intersection applies exactly as it does for any
-- other agent). No separate token table: only the OAuth-specific
-- bookkeeping (clients, codes, refresh families) lives here.

CREATE TABLE IF NOT EXISTS oauth_client (
  client_id                  TEXT PRIMARY KEY,
  client_name                TEXT,
  redirect_uris_json         TEXT NOT NULL,
  token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
  created_at                 TEXT NOT NULL
);

-- Single-use, short-lived. Deleted on exchange or expiry — never revivable,
-- same discipline as device_grant.
CREATE TABLE IF NOT EXISTS oauth_authorization_code (
  code_hash             TEXT PRIMARY KEY,
  client_id             TEXT NOT NULL REFERENCES oauth_client(client_id) ON DELETE CASCADE,
  redirect_uri          TEXT NOT NULL,
  code_challenge        TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  resource              TEXT NOT NULL,
  agent_principal_id    TEXT NOT NULL REFERENCES principal(id) ON DELETE CASCADE,
  operator_user_id      TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  workspace_id          TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  expires_at            TEXT NOT NULL,
  created_at             TEXT NOT NULL
);

-- Rotated on every use. `family_id` links every generation descended from
-- one authorization — replaying a used token revokes the whole family,
-- including whatever access token was minted from its latest generation.
CREATE TABLE IF NOT EXISTS oauth_refresh_token (
  token_hash          TEXT PRIMARY KEY,
  family_id           TEXT NOT NULL,
  client_id           TEXT NOT NULL REFERENCES oauth_client(client_id) ON DELETE CASCADE,
  agent_principal_id  TEXT NOT NULL REFERENCES principal(id) ON DELETE CASCADE,
  workspace_id        TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  resource            TEXT NOT NULL,
  current_api_token_id TEXT REFERENCES api_token(id) ON DELETE SET NULL,
  used                INTEGER NOT NULL DEFAULT 0,
  revoked             INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_refresh_family ON oauth_refresh_token(family_id);
