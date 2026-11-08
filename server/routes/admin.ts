import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from './auth.js';

export const adminRouter = Router();

/** Admin-only: list registered users (no password hashes). */
adminRouter.get('/users', requireAuth, requireRole('admin'), (_req, res) => {
  const users = db
    .prepare('SELECT id, name, email, organization, role, created_at AS createdAt FROM users ORDER BY created_at DESC')
    .all();
  res.json({ users });
});
