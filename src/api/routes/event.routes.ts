// File: src/api/routes/event.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { EventService } from '../../services/event.service.js';
import { SSEManager } from '../../realtime/sse.js';

export function createEventRouter(eventService: EventService, sseManager: SSEManager): Router {
  const router = Router();

  router.get('/projects/:projectId/events', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const events = await eventService.list(req.params.projectId, {
        entity_type: req.query.entity_type as string,
        entity_id: req.query.entity_id as string,
        since: req.query.since as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      });
      res.json(events);
    } catch (err) {
      next(err);
    }
  });

  router.get('/projects/:projectId/events/stream', (req: Request, res: Response) => {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    sseManager.addClient(req.params.projectId, clientId, res);
  });

  return router;
}
