import { config } from './config.js';
import { createApp } from './app.js';
import { db } from './db.js';
import { startGfwScheduler, stopGfwScheduler } from './data/gfwIngestion.js';

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`ATmosIQ server on :${config.port} (${config.isProd ? 'production' : 'development'})`);
  startGfwScheduler();
});

function gracefulShutdown(signal: string) {
  console.log(`[server] Received ${signal}, shutting down gracefully...`);
  stopGfwScheduler();
  server.close(() => {
    try {
      db.close();
      console.log('[server] SQLite database closed.');
    } catch (err) {
      console.error('[server] Error closing SQLite database:', err);
    }
    console.log('[server] HTTP server closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
