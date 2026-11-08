import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import './db.js';
import { authRouter } from './routes/auth.js';
import { dataRouter } from './routes/data.js';
import { adminRouter } from './routes/admin.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // behind AWS load balancer / nginx
  app.disable('x-powered-by');

  app.use(
    helmet({
      // HSTS only makes sense over HTTPS; skip it for plain-HTTP demo deployments (COOKIE_SECURE=false).
      strictTransportSecurity: config.cookieSecure,
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'upgrade-insecure-requests': null, // app may be served over plain HTTP on a bare EC2 instance
          'img-src': ["'self'", 'data:', 'blob:', 'https://*.basemaps.cartocdn.com', 'https://*.tile.openstreetmap.org', 'https://*.arcgisonline.com', 'https://raw.githubusercontent.com', 'https://cdn.jsdelivr.net', 'https://cdn.21st.dev', 'https://www.gstatic.com', 'https://images.unsplash.com'],
          'connect-src': ["'self'", 'data:', 'blob:', 'https://*.basemaps.cartocdn.com', 'https://*.tile.openstreetmap.org', 'https://*.arcgisonline.com', 'https://nominatim.openstreetmap.org', 'https://cdn.jsdelivr.net', 'https://www.gstatic.com', 'https://cdn.21st.dev'],
          'worker-src': ["'self'", 'blob:', 'data:'],
          'child-src': ["'self'", 'blob:'],
          'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdn.21st.dev'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'script-src': ["'self'", "'wasm-unsafe-eval'", "'unsafe-eval'", 'blob:', 'https://www.gstatic.com', 'https://cdn.jsdelivr.net'],
        },
      },
    })
  );
  app.use(express.json({ limit: '20kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      time: new Date().toISOString(),
      integrations: { firms: !!config.firmsKey, gemini: !!config.geminiKey },
    });
  });
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1', dataRouter);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Serve the built front end with SPA fallback (so /dashboard works on refresh).
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[server]', err);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
