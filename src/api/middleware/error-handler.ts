// File: src/api/middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors.js';
import { PermissionDeniedError } from '../../shared/permission-enforcer.js';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  console.error(err);

  // Thrown by business-rule grant checks made inside a route handler, not
  // just the permissionGuard middleware — same refusal shape either way.
  if (err instanceof PermissionDeniedError) {
    res.status(403).json(err.refusal);
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  res.status(500).json({ error: 'Internal Server Error' });
}
