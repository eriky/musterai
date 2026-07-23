// File: src/api/routes/document.routes.ts
import { Router } from 'express';
import { DocumentService } from '../../services/index.js';

export function createDocumentRoutes(documentService: DocumentService): Router {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const result = await documentService.create(req.body);
      res.status(201).json(result);
    } catch (err) { next(err); }
  });

  router.get('/', async (req, res, next) => {
    try {
      const result = await documentService.list(req.query.projectId as string, req.query as any);
      res.json(result);
    } catch (err) { next(err); }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const version = req.query.version ? parseInt(req.query.version as string, 10) : undefined;
      const result = await documentService.getById(req.params.id, version);
      res.json(result);
    } catch (err) { next(err); }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const result = await documentService.update(req.params.id, req.body);
      res.json(result);
    } catch (err) { next(err); }
  });

  router.post('/:id/status', async (req, res, next) => {
    try {
      const result = await documentService.setStatus(req.params.id, req.body.status);
      res.json(result);
    } catch (err) { next(err); }
  });

  router.get('/:id/history', async (req, res, next) => {
    try {
      const result = await documentService.getHistory(req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  });

  return router;
}
