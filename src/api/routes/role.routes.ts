// File: src/api/routes/role.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { RoleService } from '../../services/role.service.js';
import { OPEN_AUTH_CONTEXT } from '../../shared/auth-context.js';
import { assertPermissionsGrantable } from '../../shared/permission-enforcer.js';

export function createRoleRouter(roleService: RoleService): Router {
  const router = Router();

  router.get('/workspaces/:workspaceId/roles', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roles = await roleService.list(req.params.workspaceId);
      res.json(roles);
    } catch (err) {
      next(err);
    }
  });

  router.get('/roles/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = await roleService.getById(req.params.id);
      if (!role) return res.status(404).json({ error: 'Role not found' });
      res.json(role);
    } catch (err) {
      next(err);
    }
  });

  router.post('/workspaces/:workspaceId/roles', async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertPermissionsGrantable(req.authContext || OPEN_AUTH_CONTEXT, req.body.permissions || []);
      const role = await roleService.create({ ...req.body, workspace_id: req.params.workspaceId });
      res.status(201).json(role);
    } catch (err) {
      next(err);
    }
  });

  router.put('/roles/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.body.permissions) assertPermissionsGrantable(req.authContext || OPEN_AUTH_CONTEXT, req.body.permissions);
      const role = await roleService.update(req.params.id, req.body);
      res.json(role);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/roles/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await roleService.delete(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  router.post('/roles/:id/clone', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = await roleService.clone(req.params.id, req.body.new_key, req.body.new_name);
      res.status(201).json(role);
    } catch (err) {
      next(err);
    }
  });

  return router;
}