-- File: src/db/migrations/003-device-grant.sql
--
-- OAuth 2.0 Device Authorization Grant (RFC 8628) for `muster login`
-- (MUS-28). device_code is stored only as a hash — the plaintext is shown
-- to the CLI exactly once, at creation. user_code is short and stored in
-- the clear since it's meant to be read aloud/typed by a human and is
-- rate-limited at the API layer rather than kept secret.
--
-- No plaintext access token is ever persisted here: on a successful poll
-- after approval, a normal api_token row is minted the same way the PAT
-- path does, and this row is deleted — single-use, exactly once.

CREATE TABLE IF NOT EXISTS device_grant (
  id                TEXT PRIMARY KEY,
  device_code_hash  TEXT NOT NULL,
  user_code         TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  principal_id      TEXT REFERENCES principal(id) ON DELETE SET NULL,
  workspace_id      TEXT REFERENCES workspace(id) ON DELETE CASCADE,
  interval_seconds  INTEGER NOT NULL DEFAULT 5,
  last_polled_at    TEXT,
  expires_at        TEXT NOT NULL,
  created_at        TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_grant_code_hash ON device_grant(device_code_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_grant_user_code ON device_grant(user_code);
