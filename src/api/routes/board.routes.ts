// File: src/api/routes/board.routes.ts
import { Router } from 'express';
import { BoardService } from '../../services/index.js';

export function createBoardRoutes(boardService: BoardService): Router {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const result = await boardService.create(req.body);
      res.status(201).json(result);
    } catch (err) { next(err); }
  });

  router.get('/', async (req, res, next) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      if (projectId) {
        const result = await boardService.list(projectId);
        res.json(result);
      } else {
        const result = await boardService.listAll();
        res.json(result);
      }
    } catch (err) { next(err); }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const result = await boardService.getById(req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  });

  router.post('/:id/labels', async (req, res, next) => {
    try {
      const result = await boardService.createLabel({ ...req.body, board_id: req.params.id });
      res.status(201).json(result);
    } catch (err) { next(err); }
  });

  router.get('/:id/labels', async (req, res, next) => {
    try {
      const result = await boardService.listLabels(req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  });

  return router;
}
