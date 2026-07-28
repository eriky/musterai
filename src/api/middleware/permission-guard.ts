// File: src/api/middleware/permission-guard.ts
//
// Express middleware that checks the authenticated principal's permissions
// against the REST route permission map before allowing the request through.

import { Request, Response, NextFunction } from 'express';
import { AuthContext } from '../../shared/auth-context.js';
import { requireRestPermission, PermissionDeniedError } from '../../shared/permission-enforcer.js';

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
    }
  }
}

export function permissionGuard(req: Request, res: Response, next: NextFunction): void {
  // req.path is relative to wherever this middleware is mounted — inside the
  // nested v1 router it comes back as e.g. "/health", not "/api/v1/health",
  // which silently fails every anchored pattern in REST_ROUTE_PERMISSIONS.
  // req.originalUrl is the one representation that is stable regardless of
  // router nesting depth, so route matching (and the /auth/ exemption below)
  // must use it, not req.path.
  const fullPath = req.originalUrl.split('?')[0];

  // The auth routes (login/callback/logout/me) are the mechanism by which a
  // principal is established in the first place — they cannot themselves
  // require a permission the caller has no way to hold yet. The device-code
  // and token endpoints of the Device Authorization Grant (MUS-28) are the
  // same story for a not-yet-authenticated CLI; device/lookup|approve|deny
  // are NOT exempted — those run as the already-signed-in approving user.
  if (fullPath.includes('/auth/') || fullPath === '/api/v1/oauth/device/code' || fullPath === '/api/v1/oauth/token') {
    next();
    return;
  }

  const auth = req.authContext;
  if (!auth) {
    // No auth context — unlikely but guard against it
    res.status(403).json({
      error: 'forbidden',
      message: 'No authentication context available',
    });
    return;
  }

  try {
    requireRestPermission(req.method, fullPath, auth);
    next();
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      res.status(403).json(err.refusal);
      return;
    }
    next(err);
  }
}