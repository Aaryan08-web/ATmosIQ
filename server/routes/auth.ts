import crypto from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { db, type UserRow } from '../db.js';

const COOKIE = 'atmq_session';
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

const signupSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your full name.').max(80),
  email: z.string().trim().toLowerCase().email('Please provide a valid email address.'),
  organization: z.string().trim().max(120).optional(),
  password: z.string().min(8, 'Password must contain at least 8 characters.').max(128),
});
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Please enter your password.').max(128),
  rememberMe: z.boolean().optional(),
});

function publicUser(row: UserRow) {
  const initials =
    row.name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'AQ';
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    organization: row.organization ?? undefined,
    role: row.role,
    avatarInitials: initials,
    createdAt: row.created_at,
  };
}

/**
 * remember=true  -> persistent cookie, valid 7 days.
 * remember=false -> session cookie (dropped when the browser closes), token valid 1 day.
 */
function issueSession(res: Response, userId: string, remember = true) {
  const token = jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: remember ? '7d' : '1d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    ...(remember ? { maxAge: 7 * 24 * 3600 * 1000 } : {}),
    path: '/',
  });
}

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[COOKIE];
    if (!token) throw new Error('no token');
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Authentication required.' });
  }
}

/** Allows the request only if the signed-in user has one of the given roles. Use after requireAuth. */
export function requireRole(...roles: UserRow['role'][]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const row = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as Pick<UserRow, 'role'> | undefined;
    if (!row || !roles.includes(row.role)) {
      res.status(403).json({ error: 'You do not have permission to do that.' });
      return;
    }
    next();
  };
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

export const authRouter = Router();

authRouter.post('/signup', authLimiter, async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { name, email, organization, password } = parsed.data;
  const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
  if (exists) {
    res.status(409).json({ error: 'An account with this email already exists. Please sign in instead.' });
    return;
  }
  const row: UserRow = {
    id: crypto.randomUUID(),
    name,
    email,
    organization: organization || null,
    role: config.adminEmails.includes(email) ? 'admin' : 'analyst',
    password_hash: await bcrypt.hash(password, 12),
    failed_attempts: 0,
    locked_until: 0,
    created_at: new Date().toISOString().split('T')[0],
  };
  db.prepare(
    `INSERT INTO users (id,name,email,organization,role,password_hash,failed_attempts,locked_until,created_at)
     VALUES (@id,@name,@email,@organization,@role,@password_hash,@failed_attempts,@locked_until,@created_at)`
  ).run(row);
  issueSession(res, row.id);
  res.status(201).json({ user: publicUser(row) });
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { email, password, rememberMe } = parsed.data;
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
  const invalid = { error: 'Invalid email or password.' };

  if (!row) {
    await bcrypt.compare(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv'); // equalise timing
    res.status(401).json(invalid);
    return;
  }
  const failKey = `${email}|${req.ip}`;
  const fail = db.prepare('SELECT attempts, locked_until FROM login_failures WHERE key = ?').get(failKey) as
    | { attempts: number; locked_until: number }
    | undefined;
  if (fail && fail.locked_until > Date.now()) {
    res.status(429).json({ error: 'Too many failed attempts from this device. Try again in 15 minutes.' });
    return;
  }
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    const attempts = (fail && fail.locked_until === 0 ? fail.attempts : 0) + 1;
    const lockedUntil = attempts >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0;
    db.prepare(
      `INSERT INTO login_failures (key, attempts, locked_until) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET attempts = excluded.attempts, locked_until = excluded.locked_until`
    ).run(failKey, lockedUntil ? 0 : attempts, lockedUntil);
    res.status(401).json(invalid);
    return;
  }
  db.prepare('DELETE FROM login_failures WHERE key = ?').run(failKey);
  issueSession(res, row.id, rememberMe ?? true);
  res.json({ user: publicUser(row) });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req: AuthedRequest, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow | undefined;
  if (!row) {
    res.clearCookie(COOKIE, { path: '/' });
    res.status(401).json({ error: 'Session expired.' });
    return;
  }
  res.json({ user: publicUser(row) });
});

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty.').max(80).optional(),
  organization: z.string().trim().max(120).optional(),
});

authRouter.patch('/profile', requireAuth, (req: AuthedRequest, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow | undefined;
  if (!current) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  const newName = parsed.data.name ?? current.name;
  const newOrg = parsed.data.organization !== undefined ? (parsed.data.organization || null) : current.organization;
  db.prepare('UPDATE users SET name = ?, organization = ? WHERE id = ?').run(newName, newOrg, req.userId);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow;
  res.json({ user: publicUser(updated) });
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Please enter your current password.'),
  newPassword: z.string().min(8, 'New password must contain at least 8 characters.').max(128),
});

authRouter.post('/change-password', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { currentPassword, newPassword } = parsed.data;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow | undefined;
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Current password is incorrect.' });
    return;
  }
  const newHash = await bcrypt.hash(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.userId);
  res.json({ ok: true, message: 'Password updated successfully.' });
});
