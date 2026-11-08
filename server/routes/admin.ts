import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth, requireRole } from './auth.js';
import { getGfwSyncStatus } from '../data/gfwIngestion.js';

export const adminRouter = Router();

/** Admin-only: list registered users (no password hashes). */
adminRouter.get('/users', requireAuth, requireRole('admin'), (_req, res) => {
  const users = db
    .prepare('SELECT id, name, email, organization, role, created_at AS createdAt FROM users ORDER BY created_at DESC')
    .all();
  res.json({ users });
});

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'analyst', 'researcher', 'observer']),
});

/** Admin-only: update user role. */
adminRouter.post('/users/:id/role', requireAuth, requireRole('admin'), (req, res) => {
  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid role. Must be one of: admin, analyst, researcher, observer.' });
    return;
  }

  const { id } = req.params;
  const user = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(id) as { id: string; email: string; role: string } | undefined;
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(parsed.data.role, id);
  res.json({ ok: true, id, role: parsed.data.role });
});

/** Admin-only: system telemetry and database audit stats. */
adminRouter.get('/stats', requireAuth, requireRole('admin'), (_req, res) => {
  const userCount = (db.prepare('SELECT count(*) as c FROM users').get() as { c: number }).c;
  const alertCount = (db.prepare('SELECT count(*) as c FROM environmental_alerts').get() as { c: number }).c;
  const snapshotCount = (db.prepare('SELECT count(*) as c FROM environmental_snapshots').get() as { c: number }).c;
  const gfwAlertCount = (db.prepare('SELECT count(*) as c FROM gfw_forest_alerts').get() as { c: number }).c;
  const gfwStatus = getGfwSyncStatus();

  res.json({
    users: userCount,
    alerts: alertCount,
    snapshots: snapshotCount,
    gfwAlerts: gfwAlertCount,
    gfwSync: gfwStatus,
    timestamp: new Date().toISOString(),
  });
});
