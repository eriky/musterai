// File: src/api/routes/column.routes.ts
import { Router } from 'express';
import { ColumnService } from '../../services/index.js';

export function createColumnRoutes(columnService: ColumnService): Router {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const result = await columnService.create(req.body);
      res.status(201).json(result);
    } catch (err) { next(err); }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const result = await columnService.update(req.params.id, req.body);
      res.json(result);
    } catch (err) { next(err); }
  });

  router.post('/:id/move', async (req, res, next) => {
    try {
      const result = await columnService.move(req.params.id, req.body.position);
      res.json(result);
    } catch (err) { next(err); }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await columnService.delete(req.params.id);
      res.status(204).end();
    } catch (err) { next(err); }
  });

  return router;
}
