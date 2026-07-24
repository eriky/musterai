// File: src/api/routes/card.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { CardService } from '../../services/card.service.js';
import { CommentService } from '../../services/comment.service.js';

export function createCardRouter(cardService: CardService, commentService: CommentService): Router {
  const router = Router();

  router.get('/boards/:boardId/cards', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cards = await cardService.list({
        board_id: req.params.boardId,
        column_id: req.query.column_id as string,
        assignee_id: req.query.assignee_id as string,
        label: req.query.label as string,
        archived: req.query.archived === 'true',
      });
      res.json(cards);
    } catch (err) {
      next(err);
    }
  });

  router.post('/columns/:columnId/cards', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const card = await cardService.create({ ...req.body, column_id: req.params.columnId });
      res.status(201).json(card);
    } catch (err) {
      next(err);
    }
  });

  router.get('/cards/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const card = await cardService.getById(req.params.id);
      res.json(card);
    } catch (err) {
      next(err);
    }
  });

  router.put('/cards/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const card = await cardService.update(req.params.id, req.body);
      res.json(card);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/cards/:id/move', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const card = await cardService.move(req.params.id, req.body);
      res.json(card);
    } catch (err) {
      next(err);
    }
  });

  router.post('/cards/:id/comments', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const comment = await commentService.create({ ...req.body, card_id: req.params.id });
      res.status(201).json(comment);
    } catch (err) {
      next(err);
    }
  });

  router.post('/cards/:id/assignees', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await cardService.assign(req.params.id, req.body.agent_id);
      const card = await cardService.getById(req.params.id);
      res.json(card);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/cards/:id/assignees/:agentId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await cardService.unassign(req.params.id, req.params.agentId);
      const card = await cardService.getById(req.params.id);
      res.json(card);
    } catch (err) {
      next(err);
    }
  });

  router.post('/cards/:id/labels', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await cardService.addLabel(req.params.id, req.body.label_id);
      const card = await cardService.getById(req.params.id);
      res.json(card);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/cards/:id/labels/:labelId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await cardService.removeLabel(req.params.id, req.params.labelId);
      const card = await cardService.getById(req.params.id);
      res.json(card);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/cards/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await cardService.archive(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // Document links
  router.post('/cards/:id/documents', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await cardService.linkDocument(req.params.id, req.body.document_id);
      const card = await cardService.getById(req.params.id);
      res.json(card);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/cards/:id/documents/:documentId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await cardService.unlinkDocument(req.params.id, req.params.documentId);
      const card = await cardService.getById(req.params.id);
      res.json(card);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
