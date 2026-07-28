// File: src/api/routes/audit.routes.ts
//
// Read-only audit log listing (MUS-30). There is no write endpoint —
// every row is a side effect of the privileged action it records, written
// by the server, never accepted as client input.

import { Router, Request, Response, NextFunction } from 'express';
import { AuditService } from '../../services/audit.service.js';

export function createAuditRouter(auditService: AuditService): Router {
  const router = Router();

  router.get('/workspaces/:workspaceId/audit-log', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const records = await auditService.list(req.params.workspaceId, {
        actor_id: req.query.actor_id as string | undefined,
        action: req.query.action as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      });
      res.json(records);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
