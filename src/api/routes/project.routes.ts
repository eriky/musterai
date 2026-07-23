// File: src/api/routes/project.routes.ts
import { Router } from 'express';
import { ProjectService } from '../../services/index.js';

export function createProjectRoutes(projectService: ProjectService): Router {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const result = await projectService.create(req.body);
      res.status(201).json(result);
    } catch (err) { next(err); }
  });

  router.get('/', async (req, res, next) => {
    try {
      const result = await projectService.list();
      res.json(result);
    } catch (err) { next(err); }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const result = await projectService.getById(req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  });

  router.get('/:id/summary', async (req, res, next) => {
    try {
      const result = await projectService.getSummary(req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  });

  return router;
}
