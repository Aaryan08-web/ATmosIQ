import 'dotenv/config';
import crypto from 'node:crypto';

const isProd = process.env.NODE_ENV === 'production';

const cleanEnv = (val?: string) => (val ?? '').trim().replace(/^["']|["']$/g, '').trim();

let jwtSecret = cleanEnv(process.env.JWT_SECRET);
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
  dbPath: cleanEnv(process.env.DB_PATH) || './data/atmosiq.db',
  firmsKey: cleanEnv(process.env.FIRMS_MAP_KEY),
  firmsDefaultSource: cleanEnv(process.env.FIRMS_DEFAULT_SOURCE) || 'VIIRS_NOAA20_NRT',
  gfwKey: cleanEnv(process.env.GFW_API_KEY),
  appUrl: cleanEnv(process.env.APP_URL),
  gfwOrigin: cleanEnv(process.env.GFW_API_ORIGIN) || cleanEnv(process.env.APP_URL) || 'http://localhost:3000',
  gfwSyncIntervalMinutes: Number(process.env.GFW_SYNC_INTERVAL_MINUTES) || 360,
  // Comma-separated emails that receive the 'admin' role when they sign up.
  adminEmails: (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => cleanEnv(e).toLowerCase())
    .filter(Boolean),
  geminiKey: cleanEnv(process.env.GEMINI_API_KEY),
  geminiModel: cleanEnv(process.env.GEMINI_MODEL) || 'gemini-3.8-flash',
};
