// File: src/api/routes/event.routes.ts
import { Router } from 'express';
import { EventService } from '../../services/index.js';
import { SSEManager } from '../../realtime/sse.js';

export function createEventRoutes(eventService: EventService, sseManager: SSEManager): Router {
  const router = Router();

  router.get('/stream', (req, res) => {
    const projectId = req.query.projectId as string;
    if (!projectId) {
      res.status(400).json({ error: 'projectId is required' });
      return;
    }
    sseManager.addClient(res, projectId);
  });

  router.get('/', async (req, res, next) => {
    try {
      const result = await eventService.list(req.query.projectId as string, req.query as any);
      res.json(result);
    } catch (err) { next(err); }
  });

  return router;
}
