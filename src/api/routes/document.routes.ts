// File: src/api/routes/document.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { DocumentService } from '../../services/document.service.js';
import { AuthContext } from '../../shared/auth-context.js';

function getActorId(req: Request): string | undefined {
  const auth: AuthContext | undefined = (req as any).authContext;
  return auth?.principal?.id;
}

export function createDocumentRouter(documentService: DocumentService): Router {
  const router = Router();

  router.get('/projects/:projectId/documents', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = req.query.status as string;
      const parent_id = req.query.parent_id === 'null' ? null : (req.query.parent_id as string);
      const docs = await documentService.list(req.params.projectId, { status, parent_id });
      res.json(docs);
    } catch (err) {
      next(err);
    }
  });

  router.post('/projects/:projectId/documents', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await documentService.create(
        { ...req.body, project_id: req.params.projectId },
        getActorId(req)
      );
      res.status(201).json(doc);
    } catch (err) {
      next(err);
    }
  });

  router.get('/documents/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const version = req.query.version ? parseInt(req.query.version as string, 10) : undefined;
      const doc = await documentService.getById(req.params.id, version);
      if (!doc) return res.status(404).json({ error: 'Document not found' });
      res.json(doc);
    } catch (err) {
      next(err);
    }
  });

  router.put('/documents/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await documentService.update(req.params.id, req.body, getActorId(req));
      res.json(doc);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/documents/:id/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await documentService.setStatus(req.params.id, req.body.status);
      res.json(doc);
    } catch (err) {
      next(err);
    }
  });

  router.get('/documents/:id/versions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const history = await documentService.getHistory(req.params.id);
      res.json(history);
    } catch (err) {
      next(err);
    }
  });

  return router;
}