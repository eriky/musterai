// File: src/api/routes/agent.routes.ts
import { Router } from 'express';
import { AgentService } from '../../services/index.js';

export function createAgentRoutes(agentService: AgentService): Router {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const result = await agentService.register(req.body);
      res.status(201).json(result);
    } catch (err) { next(err); }
  });

  router.post('/:id/heartbeat', async (req, res, next) => {
    try {
      await agentService.heartbeat(req.params.id);
      res.status(204).end();
    } catch (err) { next(err); }
  });

  router.get('/', async (req, res, next) => {
    try {
      const result = await agentService.list(req.query.projectId as string);
      res.json(result);
    } catch (err) { next(err); }
  });

  return router;
}
