// File: src/api/middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors.js';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  console.error(err);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  res.status(500).json({ error: 'Internal Server Error' });
}
