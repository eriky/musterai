// File: src/api/routes/user.routes.ts
//
// Read-only workspace member listing (MUS-32). Powers the agent roster's
// operator lookup and the activity feed / assignee pickers; the full
// member-management surface (invite, remove, change role) is MUS-26.

import { Router, Request, Response, NextFunction } from 'express';
import { DatabaseAdapter } from '../../db/adapter.js';
import { UserService } from '../../services/user.service.js';

export function createUserRouter(db: DatabaseAdapter, userService: UserService): Router {
  const router = Router();

  router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const wsRows = await db.query<{ id: string }>('SELECT id FROM workspace LIMIT 1');
      const workspaceId = wsRows[0]?.id;
      if (!workspaceId) {
        res.json([]);
        return;
      }
      const members = await userService.listMembers(workspaceId);
      res.json(members);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
