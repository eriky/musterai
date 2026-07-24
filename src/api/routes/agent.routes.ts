// File: src/api/routes/agent.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { AgentService } from '../../services/agent.service.js';

export function createAgentRouter(agentService: AgentService): Router {
  const router = Router();

  // Get Human Owner Secret Token (for UI display)
  router.get('/settings/human-secret', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const secret_token = await agentService.getHumanSecretToken();
      res.json({ secret_token });
    } catch (err) {
      next(err);
    }
  });

  // Global agent list
  router.get('/agents', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agents = await agentService.list();
      res.json(agents);
    } catch (err) {
      next(err);
    }
  });

  // Register a new global agent (or re-bind existing session)
  router.post('/agents', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agent = await agentService.register(req.body);
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
