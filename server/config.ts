import 'dotenv/config';
import crypto from 'node:crypto';

const isProd = process.env.NODE_ENV === 'production';

let jwtSecret = process.env.JWT_SECRET ?? '';
if (!jwtSecret) {
  if (isProd) throw new Error('JWT_SECRET must be set in production');
  jwtSecret = crypto.randomBytes(32).toString('hex'); // dev only: sessions reset on restart
  console.warn('[config] JWT_SECRET not set; using a temporary dev secret');
}

export const config = {
  isProd,
  port: Number(process.env.PORT ?? 8080),
  jwtSecret,
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd,
  dbPath: process.env.DB_PATH ?? './data/atmosiq.db',
  firmsKey: process.env.FIRMS_MAP_KEY ?? '',
  gfwKey: process.env.GFW_API_KEY ?? '',
  // Comma-separated emails that receive the 'admin' role when they sign up.
  adminEmails: (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
  geminiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-3.8-flash',
};
