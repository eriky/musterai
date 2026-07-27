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
    requireRestPermission(req.method, req.path, auth);
    next();
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      res.status(403).json(err.refusal);
      return;
    }
    next(err);
  }
}