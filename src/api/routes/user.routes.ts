// File: src/api/routes/user.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { DatabaseAdapter } from '../../db/adapter.js';

export function createUserRouter(db: DatabaseAdapter): Router {
  const router = Router();

  router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await db.query<any>('SELECT * FROM app_user ORDER BY display_name ASC');
      res.json(users.map(u => ({
        id: u.id,
        display_name: u.display_name,
        email: u.email,
        avatar_url: u.avatar_url,
        status: u.status,
        created_at: u.created_at,
      })));
    } catch (err) {
      next(err);
    }
  });

  router.get('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await db.query<any>('SELECT * FROM app_user WHERE id = ?', [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: 'User not found' });
      const u = rows[0];
      res.json({
        id: u.id,
        display_name: u.display_name,
        email: u.email,
        avatar_url: u.avatar_url,
        status: u.status,
        created_at: u.created_at,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}