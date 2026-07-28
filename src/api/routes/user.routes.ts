// File: src/api/routes/user.routes.ts
//
// Read-only workspace member listing (MUS-32). Powers the agent roster's
// operator lookup and the activity feed / assignee pickers; the full
// member-management surface (invite, remove, change role) is MUS-26.

import { Router, Request, Response, NextFunction } from 'express';
import { DatabaseAdapter } from '../../db/adapter.js';
import { UserService } from '../../services/user.service.js';
import { RoleService } from '../../services/role.service.js';
import { OPEN_AUTH_CONTEXT } from '../../shared/auth-context.js';
import { assertPermissionsGrantable } from '../../shared/permission-enforcer.js';

export function createUserRouter(db: DatabaseAdapter, userService: UserService, roleService: RoleService): Router {
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

  router.put('/workspaces/:workspaceId/members/:userId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetRole = await roleService.getById(req.body.role_id);
      if (targetRole) {
        assertPermissionsGrantable(req.authContext || OPEN_AUTH_CONTEXT, targetRole.permissions);
      }
      await userService.changeMemberRole(req.params.workspaceId, req.params.userId, req.body.role_id);
      const members = await userService.listMembers(req.params.workspaceId);
      res.json(members.find(m => m.id === req.params.userId) || null);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/workspaces/:workspaceId/members/:userId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await userService.removeMember(req.params.workspaceId, req.params.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
