// File: src/api/middleware/auth.ts
//
// MUS-24: Bearer token authentication middleware.
// Parses Authorization: Bearer <token>, verifies against the api_token table,
// resolves the principal, effective permissions, and populates req.authContext.
//
// Under MUSTER_AUTH_MODE=open, requests without a valid token fall through to
// OPEN_AUTH_CONTEXT (local dev). Under enforced mode, missing/invalid tokens
// return 401.
//
// The middleware never distinguishes "no such token" from "wrong token" in
// timing, message, or status code.

import { Request, Response, NextFunction } from 'express';
import { DatabaseAdapter } from '../../db/adapter.js';
import { TokenService } from '../../services/token.service.js';
import { RoleService } from '../../services/role.service.js';
import { AgentService } from '../../services/agent.service.js';
import { AuthContext, OPEN_AUTH_CONTEXT } from '../../shared/auth-context.js';
import { config } from '../../config/index.js';
import { getRetryAfterMs, recordFailedAttempt, recordSuccessfulAttempt } from './rate-limiter.js';

export function createAuthMiddleware(
  db: DatabaseAdapter,
  tokenService: TokenService,
  roleService: RoleService,
  agentService: AgentService,
) {
  return async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

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

      // No auth header — use OPEN_AUTH_CONTEXT in open mode, 401 in enforced
      if (!authHeader) {
        if (config.auth.mode === 'enforced') {
          _res.status(401).json({
            error: 'unauthorized',
            message: 'Authentication required. Provide a Bearer token in the Authorization header.',
          });
          return;
        }
        (req as any).authContext = OPEN_AUTH_CONTEXT;
        next();
        return;
      }

      // Parse "Bearer <token>"
      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        recordFailedAttempt(clientIp);
        if (config.auth.mode === 'enforced') {
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

      // Verify the token — null on any failure (unknown, revoked, expired)
      const verification = await tokenService.verify(tokenString);

      if (!verification) {
        recordFailedAttempt(clientIp);
        if (config.auth.mode === 'enforced') {
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

      // Resolve the principal kind from the principal table
      const principals = await db.query<{ kind: string }>(
        'SELECT kind FROM principal WHERE id = ?',
        [verification.principal_id],
      );

      const principalKind = principals.length > 0 ? (principals[0].kind as 'user' | 'agent') : 'user';

      // Resolve effective permissions and role name
      let permissions: string[] = [];
      let roleName: string | null = null;
      let isOperatorOverride = false;

      if (principalKind === 'agent') {
        const effectivePerms = await roleService.getEffectivePermissions(verification.principal_id);
        permissions = effectivePerms;

        const agent = await agentService.getById(verification.principal_id);
        if (agent?.role_id) {
          const role = await roleService.getById(agent.role_id);
          roleName = role?.name || null;
        }

        isOperatorOverride = false;
      } else {
        const memberRows = await db.query<any>(
          `SELECT wm.role_id, r.name as role_name, r.permissions_json
           FROM workspace_member wm
           JOIN role r ON r.id = wm.role_id
           WHERE wm.user_id = ? AND wm.workspace_id = ?`,
          [verification.principal_id, verification.workspace_id],
        );

        if (memberRows.length > 0) {
          permissions = typeof memberRows[0].permissions_json === 'string'
            ? JSON.parse(memberRows[0].permissions_json)
            : (memberRows[0].permissions_json || []);
          roleName = memberRows[0].role_name || null;
        }

        isOperatorOverride = permissions.includes('workspace.admin');
      }

      const authContext: AuthContext = {
        principal: { kind: principalKind, id: verification.principal_id },
        workspace_id: verification.workspace_id,
        permissions,
        is_operator_override: isOperatorOverride,
        role_name: roleName,
      };

      (req as any).authContext = authContext;
      next();
    } catch (err) {
      next(err);
    }
  };
}