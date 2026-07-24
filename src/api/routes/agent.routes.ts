// File: src/api/routes/agent.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { AgentService } from '../../services/agent.service.js';

export function createAgentRouter(agentService: AgentService): Router {
  const router = Router();

  router.get('/projects/:projectId/agents', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agents = await agentService.list(req.params.projectId);
      res.json(agents);
    } catch (err) {
      next(err);
    }
  });

  router.post('/projects/:projectId/agents', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agent = await agentService.register({ ...req.body, project_id: req.params.projectId });
      res.status(201).json(agent);
    } catch (err) {
      next(err);
    }
  });

  router.post('/agents/:id/heartbeat', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agent = await agentService.heartbeat(req.params.id);
      res.json(agent);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/agents/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.headers['x-actor-id'] as string | undefined;
      await agentService.unregister(req.params.id, actorId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
