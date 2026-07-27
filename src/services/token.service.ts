// File: src/services/token.service.ts
//
// Personal Access Token (PAT) management for MUS-24.
// Tokens are minted as "muster_<prefix>_<secret>" — only the SHA-256 hash
// is stored. The plaintext secret is shown exactly once on creation.

import crypto from 'node:crypto';
import { ulid } from 'ulid';
import { DatabaseAdapter } from '../db/adapter.js';
import { ApiToken, CreatedApiToken } from '../shared/types.js';

/** Token prefix length in characters. */
const PREFIX_LENGTH = 8;

/** Secret length in bytes (generates hex string 2× this length). */
const SECRET_BYTES = 24;

/** Minimum seconds between last_used_at updates per token. */
const LAST_USED_THROTTLE_MS = 60_000;

/** The bearer-token prefix constant. */
export const TOKEN_BRAND = 'muster';

/**
 * Compute SHA-256 hex digest of a token string.
 * Always produces a 64-character lowercase hex string.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf-8').digest('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf-8');
  const bBuf = Buffer.from(b, 'utf-8');
  if (aBuf.length !== bBuf.length) {
    // Compare against self to keep constant-ish time, then return false
    crypto.timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Generate a cryptographically random hex string.
 */
function randomHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export interface TokenVerification {
  id: string;
  principal_id: string;
  workspace_id: string;
}

export class TokenService {
  constructor(private db: DatabaseAdapter) {}

  /**
   * Create a new personal access token.
   * Returns the full token string (shown once) and the stored record.
   */
  async create(data: {
    principal_id: string;
    workspace_id: string;
    name: string;
    expires_at?: string | null;
  }): Promise<CreatedApiToken> {
    const id = ulid();
    const prefix = randomHex(PREFIX_LENGTH / 2); // 8 hex chars
    const secret = randomHex(SECRET_BYTES); // 48 hex chars
    const token = `${TOKEN_BRAND}_${prefix}_${secret}`;
    const tokenHash = hashToken(token);
    const now = new Date().toISOString();

    await this.db.execute(
      `INSERT INTO api_token (id, principal_id, workspace_id, name, token_hash, prefix, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.principal_id, data.workspace_id, data.name, tokenHash, prefix, data.expires_at || null, now],
    );

    return {
      id,
      principal_id: data.principal_id,
      workspace_id: data.workspace_id,
      name: data.name,
      prefix,
      expires_at: data.expires_at || null,
      revoked_at: null,
      last_used_at: null,
      created_at: now,
      token,
    };
  }

  /**
   * Verify a bearer token string.
   * Returns the token record's identity info on success, null on failure.
   * Throttles last_used_at updates to once per minute per token.
   */
  async verify(tokenString: string): Promise<TokenVerification | null> {
    // Parse token format: muster_<prefix>_<secret>
    const parts = tokenString.split('_');
    if (parts.length < 3 || parts[0] !== TOKEN_BRAND) return null;

    const hash = hashToken(tokenString);

    const rows = await this.db.query<any>(
      'SELECT id, principal_id, workspace_id, token_hash, expires_at, revoked_at, last_used_at FROM api_token WHERE token_hash = ?',
      [hash],
    );

    if (rows.length === 0) return null;

    const row = rows[0];

    // Constant-time re-verify the hash
    if (!timingSafeEqual(hash, row.token_hash)) return null;

    // Check revocation
    if (row.revoked_at) return null;

    // Check expiry
    if (row.expires_at && new Date(row.expires_at) <= new Date()) return null;

    // Throttled last_used_at update (once per minute)
    const now = new Date();
    const lastUsed = row.last_used_at ? new Date(row.last_used_at) : null;
    if (!lastUsed || now.getTime() - lastUsed.getTime() > LAST_USED_THROTTLE_MS) {
      await this.db.execute(
        'UPDATE api_token SET last_used_at = ? WHERE id = ?',
        [now.toISOString(), row.id],
      );
    }

    return {
      id: row.id,
      principal_id: row.principal_id,
      workspace_id: row.workspace_id,
    };
  }

  /**
   * Revoke a token immediately by setting revoked_at.
   */
  async revoke(id: string): Promise<void> {
    await this.db.execute(
      'UPDATE api_token SET revoked_at = ? WHERE id = ?',
      [new Date().toISOString(), id],
    );
  }

  /**
   * List tokens for a principal (or all tokens if no principal_id given).
   */
  async list(principalId?: string): Promise<ApiToken[]> {
    let rows: any[];
    if (principalId) {
      rows = await this.db.query(
        'SELECT id, principal_id, workspace_id, name, prefix, expires_at, revoked_at, last_used_at, created_at FROM api_token WHERE principal_id = ? ORDER BY created_at DESC',
        [principalId],
      );
    } else {
      rows = await this.db.query(
        'SELECT id, principal_id, workspace_id, name, prefix, expires_at, revoked_at, last_used_at, created_at FROM api_token ORDER BY created_at DESC',
      );
    }

    return rows.map(this.mapRow);
  }

  /**
   * Get a single token by ID.
   */
  async getById(id: string): Promise<ApiToken | null> {
    const rows = await this.db.query<any>(
      'SELECT id, principal_id, workspace_id, name, prefix, expires_at, revoked_at, last_used_at, created_at FROM api_token WHERE id = ?',
      [id],
    );
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  }

  private mapRow(row: any): ApiToken {
    return {
      id: row.id,
      principal_id: row.principal_id,
      workspace_id: row.workspace_id,
      name: row.name,
      prefix: row.prefix,
      expires_at: row.expires_at || null,
      revoked_at: row.revoked_at || null,
      last_used_at: row.last_used_at || null,
      created_at: row.created_at,
    };
  }
}