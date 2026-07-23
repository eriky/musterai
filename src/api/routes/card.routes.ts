// File: src/api/routes/card.routes.ts
import { Router } from 'express';
import { CardService, CommentService } from '../../services/index.js';

export function createCardRoutes(cardService: CardService, commentService: CommentService): Router {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const result = await cardService.create(req.body);
      res.status(201).json(result);
    } catch (err) { next(err); }
  });

  router.get('/', async (req, res, next) => {
    try {
      const result = await cardService.list(req.query as any);
      res.json(result);
    } catch (err) { next(err); }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const result = await cardService.getById(req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const result = await cardService.update(req.params.id, req.body);
      res.json(result);
    } catch (err) { next(err); }
  });

  router.post('/:id/move', async (req, res, next) => {
    try {
      const result = await cardService.move(req.params.id, req.body.target_column_id, req.body.position);
      res.json(result);
    } catch (err) { next(err); }
  });

  router.post('/:id/assign', async (req, res, next) => {
    try {
      await cardService.assign(req.params.id, req.body.agent_id);
      res.status(204).end();
    } catch (err) { next(err); }
  });

  router.post('/:id/unassign', async (req, res, next) => {
    try {
      await cardService.unassign(req.params.id, req.body.agent_id);
      res.status(204).end();
    } catch (err) { next(err); }
  });

  router.post('/:id/labels', async (req, res, next) => {
    try {
      await cardService.addLabel(req.params.id, req.body.label_id);
      res.status(204).end();
    } catch (err) { next(err); }
  });

  router.delete('/:id/labels/:labelId', async (req, res, next) => {
    try {
      await cardService.removeLabel(req.params.id, req.params.labelId);
      res.status(204).end();
    } catch (err) { next(err); }
  });

  router.post('/:id/archive', async (req, res, next) => {
    try {
      const result = await cardService.archive(req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await cardService.delete(req.params.id);
      res.status(204).end();
    } catch (err) { next(err); }
  });

  router.post('/:id/comments', async (req, res, next) => {
    try {
      const result = await commentService.create({ card_id: req.params.id, ...req.body });
      res.status(201).json(result);
    } catch (err) { next(err); }
  });

  return router;
}
