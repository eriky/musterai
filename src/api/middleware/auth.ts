// File: src/api/middleware/auth.ts
//
// Authentication middleware. Two credential kinds feed the same AuthContext:
//   - Authorization: Bearer <token>  — PATs (MUS-24), used by agents and by
//     API clients acting as a user.
//   - the session cookie (MUS-25) — browser logins via OIDC.
//
// Under MUSTER_AUTH_MODE=open, requests without either credential fall
// through to OPEN_AUTH_CONTEXT (local dev). Under enforced mode, missing or
// invalid credentials return 401 — except for the auth routes themselves
// (/api/v1/auth/*), which must be reachable by a not-yet-authenticated
// browser in order to establish a session in the first place.
//
// The middleware never distinguishes "no such credential" from "wrong
// credential" in timing, message, or status code.

import { Request, Response, NextFunction } from 'express';
import { DatabaseAdapter } from '../../db/adapter.js';
import { TokenService } from '../../services/token.service.js';
import { RoleService } from '../../services/role.service.js';
import { AgentService } from '../../services/agent.service.js';
import { SessionService } from '../../services/session.service.js';
import { AuthContext, OPEN_AUTH_CONTEXT } from '../../shared/auth-context.js';
import { config } from '../../config/index.js';
import { parseCookies } from '../../shared/cookies.js';
import { getRetryAfterMs, recordFailedAttempt, recordSuccessfulAttempt } from './rate-limiter.js';

export const SESSION_COOKIE_NAME = 'muster_session';

const AUTH_ROUTE_PREFIX = '/api/v1/auth/';

/** Resolve a user's effective permissions and role name within a workspace. */
async function resolveUserPermissions(
  db: DatabaseAdapter,
  userId: string,
  workspaceId: string | null,
): Promise<{ permissions: string[]; roleName: string | null }> {
  if (!workspaceId) return { permissions: [], roleName: null };

  const memberRows = await db.query<any>(
    `SELECT wm.role_id, r.name as role_name, r.permissions_json
     FROM workspace_member wm
     JOIN role r ON r.id = wm.role_id
     WHERE wm.user_id = ? AND wm.workspace_id = ?`,
    [userId, workspaceId],
  );

  if (memberRows.length === 0) return { permissions: [], roleName: null };

  const permissions = typeof memberRows[0].permissions_json === 'string'
    ? JSON.parse(memberRows[0].permissions_json)
    : (memberRows[0].permissions_json || []);

  return { permissions, roleName: memberRows[0].role_name || null };
}

export function createAuthMiddleware(
  db: DatabaseAdapter,
  tokenService: TokenService,
  roleService: RoleService,
  agentService: AgentService,
  sessionService: SessionService,
) {
  return async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const isAuthRoute = req.path.startsWith(AUTH_ROUTE_PREFIX);

      // Locked out from prior failed bearer attempts — refuse before touching the token
      if (authHeader) {
        const retryAfterMs = getRetryAfterMs(clientIp);
        if (retryAfterMs > 0) {
          _res.setHeader('Retry-After', Math.ceil(retryAfterMs / 1000).toString());
          _res.status(429).json({
            error: 'rate_limited',
            message: 'Too many failed authentication attempts. Try again later.',
          });
          return;
        }
      }

      // ── Bearer token path (PATs) ──
      if (authHeader) {
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
          recordFailedAttempt(clientIp);
          if (config.auth.mode === 'enforced' && !isAuthRoute) {
            _res.status(401).json({
              error: 'unauthorized',
              message: 'Malformed Authorization header. Expected: Bearer <token>',
            });
            return;
          }
          (req as any).authContext = OPEN_AUTH_CONTEXT;
          next();
          return;
        }

        const tokenString = parts[1];
        const verification = await tokenService.verify(tokenString);

        if (!verification) {
          recordFailedAttempt(clientIp);
          if (config.auth.mode === 'enforced' && !isAuthRoute) {
            _res.status(401).json({
              error: 'unauthorized',
              message: 'Invalid or expired token.',
            });
            return;
          }
          (req as any).authContext = OPEN_AUTH_CONTEXT;
          next();
          return;
        }

        recordSuccessfulAttempt(clientIp);

        const principals = await db.query<{ kind: string }>('SELECT kind FROM principal WHERE id = ?', [verification.principal_id]);
        const principalKind = principals.length > 0 ? (principals[0].kind as 'user' | 'agent') : 'user';

        let permissions: string[] = [];
        let roleName: string | null = null;
        let isOperatorOverride = false;

        if (principalKind === 'agent') {
          permissions = await roleService.getEffectivePermissions(verification.principal_id);
          const agent = await agentService.getById(verification.principal_id);
          if (agent?.role_id) {
            const role = await roleService.getById(agent.role_id);
            roleName = role?.name || null;
          }
        } else {
          const resolved = await resolveUserPermissions(db, verification.principal_id, verification.workspace_id);
          permissions = resolved.permissions;
          roleName = resolved.roleName;
          isOperatorOverride = permissions.includes('workspace.admin');
        }

        (req as any).authContext = {
          principal: { kind: principalKind, id: verification.principal_id },
          workspace_id: verification.workspace_id,
          permissions,
          is_operator_override: isOperatorOverride,
          role_name: roleName,
        } satisfies AuthContext;
        next();
        return;
      }

      // ── Session cookie path (browser logins, MUS-25) ──
      const cookies = parseCookies(req.headers.cookie);
      const sessionToken = cookies[SESSION_COOKIE_NAME];

      if (sessionToken) {
        const verification = await sessionService.verify(sessionToken);

        if (!verification) {
          recordFailedAttempt(clientIp);
          if (config.auth.mode === 'enforced' && !isAuthRoute) {
            _res.status(401).json({ error: 'unauthorized', message: 'Session is invalid or has expired.' });
            return;
          }
          (req as any).authContext = OPEN_AUTH_CONTEXT;
          next();
          return;
        }

        recordSuccessfulAttempt(clientIp);

        const wsRows = await db.query<{ id: string }>('SELECT id FROM workspace LIMIT 1');
        const workspaceId = wsRows[0]?.id || null;
        const { permissions, roleName } = await resolveUserPermissions(db, verification.user_id, workspaceId);

        (req as any).authContext = {
          principal: { kind: 'user', id: verification.user_id },
          workspace_id: workspaceId,
          permissions,
          is_operator_override: permissions.includes('workspace.admin'),
          role_name: roleName,
        } satisfies AuthContext;
        next();
        return;
      }

      // No credential at all — use OPEN_AUTH_CONTEXT in open mode or on the auth routes, 401 in enforced
      if (config.auth.mode === 'enforced' && !isAuthRoute) {
        _res.status(401).json({
          error: 'unauthorized',
          message: 'Authentication required. Provide a Bearer token or sign in.',
        });
        return;
      }
      (req as any).authContext = OPEN_AUTH_CONTEXT;
      next();
    } catch (err) {
      next(err);
    }
  };
}
