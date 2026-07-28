// File: src/services/mcp-oauth.service.ts
//
// MCP-native OAuth (MUS-29) — RFC 7591 dynamic client registration plus
// Authorization Code + PKCE per the current MCP Authorization spec (OAuth
// 2.1 draft, RFC 8707 resource indicators). The consent step mints/reuses
// an AGENT principal owned by the approving user and issues a normal
// api_token for it — the exact same object PATs and the device grant issue,
// so verification, revocation, and effective-permission intersection
// (design doc §4, via RoleService.getEffectivePermissions) are unchanged.

import crypto from 'node:crypto';
import { ulid } from 'ulid';
import { DatabaseAdapter } from '../db/adapter.js';
import { TokenService, hashToken } from './token.service.js';
import { AgentService } from './agent.service.js';
import { CreatedApiToken } from '../shared/types.js';

const AUTH_CODE_TTL_SECONDS = 120;

export interface OAuthClient {
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
  token_endpoint_auth_method: string;
}

export interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource: string;
  agentPrincipalId: string;
  operatorUserId: string;
  workspaceId: string;
}

export type TokenResult =
  | { ok: true; token: CreatedApiToken; refreshToken: string }
  | { ok: false; error: string; error_description?: string };

/** Loopback redirect URIs (RFC 8252 §7.3) may vary in port even if not pre-registered with that exact port. */
function isLoopbackHost(host: string): boolean {
  return host === '127.0.0.1' || host === '[::1]' || host === 'localhost';
}

export function redirectUriMatches(registered: string, requested: string): boolean {
  if (registered === requested) return true;
  try {
    const r = new URL(registered);
    const q = new URL(requested);
    if (!isLoopbackHost(r.hostname) || !isLoopbackHost(q.hostname)) return false;
    return r.protocol === q.protocol && r.pathname === q.pathname && r.search === q.search;
  } catch {
    return false;
  }
}

/** RFC 7636 S256: BASE64URL(SHA256(code_verifier)) === code_challenge. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  const computed = crypto.createHash('sha256').update(verifier).digest('base64url');
  // Both sides are short, non-secret-once-exchanged strings tied to a
  // single-use code — timing-safe comparison is defense in depth, not the
  // primary protection (that's the code being single-use and short-lived).
  const a = Buffer.from(computed);
  const b = Buffer.from(challenge);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export class McpOAuthService {
  constructor(
    private db: DatabaseAdapter,
    private tokenService: TokenService,
    private agentService: AgentService,
  ) {}

  async registerClient(data: { client_name?: string; redirect_uris: string[]; token_endpoint_auth_method?: string }): Promise<OAuthClient> {
    if (!Array.isArray(data.redirect_uris) || data.redirect_uris.length === 0) {
      throw new Error('redirect_uris is required and must be a non-empty array');
    }
    for (const uri of data.redirect_uris) {
      try {
        const parsed = new URL(uri);
        if (parsed.protocol !== 'https:' && !isLoopbackHost(parsed.hostname) && parsed.protocol !== 'http:') {
          throw new Error(`Invalid redirect_uri: ${uri}`);
        }
      } catch {
        throw new Error(`Invalid redirect_uri: ${uri}`);
      }
    }

    const clientId = `mcp_${crypto.randomBytes(16).toString('hex')}`;
    const now = new Date().toISOString();
    await this.db.execute(
      `INSERT INTO oauth_client (client_id, client_name, redirect_uris_json, token_endpoint_auth_method, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [clientId, data.client_name || null, JSON.stringify(data.redirect_uris), data.token_endpoint_auth_method || 'none', now],
    );

    return {
      client_id: clientId,
      client_name: data.client_name || null,
      redirect_uris: data.redirect_uris,
      token_endpoint_auth_method: data.token_endpoint_auth_method || 'none',
    };
  }

  async getClient(clientId: string): Promise<OAuthClient | null> {
    const rows = await this.db.query<any>('SELECT * FROM oauth_client WHERE client_id = ?', [clientId]);
    if (rows.length === 0) return null;
    return {
      client_id: rows[0].client_id,
      client_name: rows[0].client_name,
      redirect_uris: JSON.parse(rows[0].redirect_uris_json),
      token_endpoint_auth_method: rows[0].token_endpoint_auth_method,
    };
  }

  /** Issued after the consent screen picks (or creates) the agent identity and role. */
  async createAuthorizationCode(params: AuthorizeParams): Promise<string> {
    const code = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    await this.db.execute(
      `INSERT INTO oauth_authorization_code
         (code_hash, client_id, redirect_uri, code_challenge, code_challenge_method, resource, agent_principal_id, operator_user_id, workspace_id, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        hashToken(code), params.clientId, params.redirectUri, params.codeChallenge, params.codeChallengeMethod,
        params.resource, params.agentPrincipalId, params.operatorUserId, params.workspaceId,
        new Date(now.getTime() + AUTH_CODE_TTL_SECONDS * 1000).toISOString(), now.toISOString(),
      ],
    );
    return code;
  }

  /** Authorization Code grant — single-use: the row is deleted whether the exchange succeeds or fails on a later check. */
  async exchangeAuthorizationCode(params: {
    code: string;
    clientId: string;
    redirectUri: string;
    codeVerifier: string;
    resource: string;
  }): Promise<TokenResult> {
    const rows = await this.db.query<any>('SELECT * FROM oauth_authorization_code WHERE code_hash = ?', [hashToken(params.code)]);
    const row = rows[0];
    if (!row) return { ok: false, error: 'invalid_grant', error_description: 'Unknown or already-used authorization code' };

    // Single-use regardless of outcome — a code that fails validation must not be retryable.
    await this.db.execute('DELETE FROM oauth_authorization_code WHERE code_hash = ?', [hashToken(params.code)]);

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return { ok: false, error: 'invalid_grant', error_description: 'Authorization code expired' };
    }
    if (row.client_id !== params.clientId) {
      return { ok: false, error: 'invalid_grant', error_description: 'client_id mismatch' };
    }
    if (row.redirect_uri !== params.redirectUri) {
      return { ok: false, error: 'invalid_grant', error_description: 'redirect_uri mismatch' };
    }
    if (row.resource !== params.resource) {
      return { ok: false, error: 'invalid_target', error_description: 'resource mismatch' };
    }
    if (!verifyPkce(params.codeVerifier, row.code_challenge)) {
      return { ok: false, error: 'invalid_grant', error_description: 'PKCE verification failed' };
    }

    return this.issueTokenFamily({
      clientId: row.client_id,
      agentPrincipalId: row.agent_principal_id,
      workspaceId: row.workspace_id,
      resource: row.resource,
      familyId: ulid(),
    });
  }

  /** Refresh Token grant — rotates on every use; a replayed (already-used) token revokes the whole family. */
  async refreshToken(params: { refreshToken: string; clientId: string; resource: string }): Promise<TokenResult> {
    const hash = hashToken(params.refreshToken);
    const rows = await this.db.query<any>('SELECT * FROM oauth_refresh_token WHERE token_hash = ?', [hash]);
    const row = rows[0];
    if (!row) return { ok: false, error: 'invalid_grant', error_description: 'Unknown refresh token' };

    if (row.revoked || row.used) {
      // Reuse of an already-rotated-away token is a signal of theft —
      // revoke the entire family, including the access token it minted.
      await this.revokeFamily(row.family_id);
      return { ok: false, error: 'invalid_grant', error_description: 'Refresh token reuse detected; the token family has been revoked' };
    }
    if (row.client_id !== params.clientId) {
      return { ok: false, error: 'invalid_grant', error_description: 'client_id mismatch' };
    }
    if (row.resource !== params.resource) {
      return { ok: false, error: 'invalid_target', error_description: 'resource mismatch' };
    }

    await this.db.execute('UPDATE oauth_refresh_token SET used = 1 WHERE token_hash = ?', [hash]);
    if (row.current_api_token_id) {
      await this.tokenService.revoke(row.current_api_token_id);
    }

    return this.issueTokenFamily({
      clientId: row.client_id,
      agentPrincipalId: row.agent_principal_id,
      workspaceId: row.workspace_id,
      resource: row.resource,
      familyId: row.family_id,
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    const rows = await this.db.query<{ current_api_token_id: string | null }>(
      'SELECT current_api_token_id FROM oauth_refresh_token WHERE family_id = ? AND revoked = 0',
      [familyId],
    );
    for (const row of rows) {
      if (row.current_api_token_id) await this.tokenService.revoke(row.current_api_token_id);
    }
    await this.db.execute('UPDATE oauth_refresh_token SET revoked = 1 WHERE family_id = ?', [familyId]);
  }

  private async issueTokenFamily(params: {
    clientId: string;
    agentPrincipalId: string;
    workspaceId: string;
    resource: string;
    familyId: string;
  }): Promise<TokenResult> {
    const client = await this.getClient(params.clientId);
    const token = await this.tokenService.create({
      principal_id: params.agentPrincipalId,
      workspace_id: params.workspaceId,
      name: `MCP client: ${client?.client_name || params.clientId}`,
    });

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const now = new Date().toISOString();
    await this.db.execute(
      `INSERT INTO oauth_refresh_token (token_hash, family_id, client_id, agent_principal_id, workspace_id, resource, current_api_token_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [hashToken(refreshToken), params.familyId, params.clientId, params.agentPrincipalId, params.workspaceId, params.resource, token.id, now],
    );

    return { ok: true, token, refreshToken };
  }
}
