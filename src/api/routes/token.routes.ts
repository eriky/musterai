// File: src/api/routes/token.routes.ts
//
// REST endpoints for Personal Access Token management (MUS-24).
// Token format: muster_pat_<prefix>_<secret>.
// POST  /tokens          — create (returns plaintext secret once)
// GET   /tokens          — list tokens for the authenticated principal
// DELETE /tokens/:id     — revoke a token

import { Router, Request, Response, NextFunction } from 'express';
import { TokenService } from '../../services/token.service.js';
import { AuthContext } from '../../shared/auth-context.js';

export function createTokenRouter(tokenService: TokenService): Router {
  const router = Router();

  // List tokens for the authenticated principal
  router.get('/tokens', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth: AuthContext = (req as any).authContext;
      if (!auth?.principal?.id) {
        res.status(401).json({ error: 'unauthorized', message: 'Not authenticated' });
        return;
      }
      const tokens = await tokenService.list(auth.principal.id);
      // Never expose token_hash — only list metadata
      res.json(tokens);
    } catch (err) {
      next(err);
    }
  });

  // Create a new token
  router.post('/tokens', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth: AuthContext = (req as any).authContext;
      if (!auth?.principal?.id) {
        res.status(401).json({ error: 'unauthorized', message: 'Not authenticated' });
        return;
      }

      const { name, expires_at, target_principal_id } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'bad_request', message: 'Token name is required' });
        return;
      }

      // Default to creating a token for the authenticated principal
      const principalId = target_principal_id || auth.principal.id;
      const workspaceId = auth.workspace_id;

      if (!workspaceId) {
        res.status(400).json({ error: 'bad_request', message: 'No workspace context available' });
        return;
      }

      const created = await tokenService.create({
        principal_id: principalId,
        workspace_id: workspaceId,
        name: name.trim(),
        expires_at: expires_at || null,
      });

      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  // Revoke a token
  router.delete('/tokens/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth: AuthContext = (req as any).authContext;
      if (!auth?.principal?.id) {
        res.status(401).json({ error: 'unauthorized', message: 'Not authenticated' });
        return;
      }

      // Verify the token belongs to the authenticated principal
      const token = await tokenService.getById(req.params.id);
      if (!token) {
        res.status(404).json({ error: 'not_found', message: 'Token not found' });
        return;
      }

      if (token.principal_id !== auth.principal.id) {
        res.status(403).json({ error: 'forbidden', message: 'Token belongs to a different principal' });
        return;
      }

      if (token.revoked_at) {
        res.status(200).json({ message: 'Token already revoked', id: token.id });
        return;
      }

      await tokenService.revoke(req.params.id);
      res.status(200).json({ message: 'Token revoked', id: req.params.id });
    } catch (err) {
      next(err);
    }
  });

  return router;
}