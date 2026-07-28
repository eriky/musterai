// File: src/connect/remote-client.ts
//
// Small fetch wrapper for the handful of calls `muster login`/`logout` make
// directly against the remote server — validating a pasted token, finding
// its own token_id (by prefix) for clean revocation, and revoking it.

export interface RemoteMe {
  authenticated: boolean;
  admitted: boolean;
  user: { id: string; display_name: string } | null;
}

export interface RemoteTokenSummary {
  id: string;
  prefix: string;
  name: string;
  revoked_at: string | null;
}

export class RemoteError extends Error {}

async function get(server: string, path: string, token: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${server}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  } catch (err: any) {
    throw new RemoteError(`Cannot reach ${server}: ${err.message}`);
  }
  if (!res.ok) throw new RemoteError(`${server}${path} returned ${res.status}`);
  return res.json();
}

export async function whoAmI(server: string, token: string): Promise<RemoteMe> {
  return get(server, '/api/v1/auth/me', token);
}

export async function listMyTokens(server: string, token: string): Promise<RemoteTokenSummary[]> {
  return get(server, '/api/v1/tokens', token);
}

/** The token's own prefix segment — `muster_pat_<prefix>_<secret>` — used to find its record without ever transmitting the secret again. */
export function tokenPrefix(token: string): string | null {
  const parts = token.split('_');
  // muster_pat_<prefix>_<secret> — parts: ['muster','pat',prefix,secret]
  if (parts.length !== 4 || parts[0] !== 'muster' || parts[1] !== 'pat') return null;
  return parts[2];
}

export async function revokeToken(server: string, token: string, tokenId: string): Promise<void> {
  try {
    await fetch(`${server}/api/v1/tokens/${tokenId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Best-effort — the local credential is removed regardless; see cli.ts.
  }
}
