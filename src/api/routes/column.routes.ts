// File: src/api/routes/column.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { ColumnService } from '../../services/column.service.js';

export function createColumnRouter(columnService: ColumnService): Router {
  const router = Router();

  router.post('/boards/:boardId/columns', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const column = await columnService.create({ ...req.body, board_id: req.params.boardId });
      res.status(201).json(column);
    } catch (err) {
      next(err);
    }
  });

  router.put('/columns/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const column = await columnService.update(req.params.id, req.body);
      res.json(column);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/columns/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await columnService.delete(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
