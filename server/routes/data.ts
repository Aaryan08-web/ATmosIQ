import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getFires } from '../data/fires.js';
import { getAirQuality } from '../data/airQuality.js';
import { getDeforestation } from '../data/deforestation.js';
import { buildContext, summarise } from '../ai.js';
import { requireAuth } from './auth.js';
import { db, type EnvironmentalAlertRow, type EnvironmentalSnapshotRow } from '../db.js';

export const dataRouter = Router();

const wrap =
  (fn: (req: import('express').Request) => Promise<unknown>) =>
  async (req: import('express').Request, res: import('express').Response) => {
    try {
      res.json(await fn(req));
    } catch (err) {
      console.error('[data]', req.path, err instanceof Error ? err.message : err);
      res.status(502).json({ error: 'Upstream data source unavailable. Please try again shortly.' });
    }
  };

dataRouter.get('/fires', requireAuth, wrap((req) => getFires(Number(req.query.days) || 1)));
dataRouter.get('/air-quality', requireAuth, wrap(() => getAirQuality()));
dataRouter.get('/deforestation', requireAuth, wrap(async () => getDeforestation()));

dataRouter.get(
  '/overview',
  requireAuth,
  wrap(async () => {
    const [fires, aq] = await Promise.all([getFires(1), getAirQuality().catch(() => null)]);
    const valid = (aq?.points ?? []).filter((p) => p.usAqi != null);
    const worst = [...valid].sort((a, b) => (b.usAqi ?? 0) - (a.usAqi ?? 0))[0];

    // Snapshot storage: record snapshot if more than 5 minutes since last one
    const now = Date.now();
    const lastSnap = db.prepare('SELECT created_at FROM environmental_snapshots ORDER BY created_at DESC LIMIT 1').get() as { created_at: number } | undefined;
    if (!lastSnap || now - lastSnap.created_at > 5 * 60 * 1000) {
      const totalFrp = fires.points.reduce((acc, p) => acc + (p.frp || 0), 0);
      const snap: EnvironmentalSnapshotRow = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        fire_count: fires.total,
        unhealthy_aqi_count: valid.filter((p) => (p.usAqi ?? 0) > 150).length,
        worst_aqi: worst?.usAqi ?? null,
        worst_city: worst?.name ?? null,
        total_frp: Math.round(totalFrp),
        created_at: now,
      };
      db.prepare(
        `INSERT INTO environmental_snapshots (id, timestamp, fire_count, unhealthy_aqi_count, worst_aqi, worst_city, total_frp, created_at)
         VALUES (@id, @timestamp, @fire_count, @unhealthy_aqi_count, @worst_aqi, @worst_city, @total_frp, @created_at)`
      ).run(snap);
    }

    return {
      fires: { total: fires.total, shown: fires.points.length, live: fires.live, source: fires.source, fetchedAt: fires.fetchedAt },
      airQuality: {
        stations: valid.length,
        unhealthy: valid.filter((p) => (p.usAqi ?? 0) > 150).length,
        worst: worst ? { name: worst.name, country: worst.country, usAqi: worst.usAqi, category: worst.category } : null,
        available: !!aq,
        fetchedAt: aq?.fetchedAt ?? null,
      },
      deforestation: { hotspots: getDeforestation().points.length, live: false },
    };
  })
);

// Alert workflow with deduplication fingerprint
dataRouter.get(
  '/alerts',
  requireAuth,
  wrap(async () => {
    const [fires, aq] = await Promise.all([getFires(1), getAirQuality().catch(() => null)]);
    const def = getDeforestation();

    const insertStmt = db.prepare(`
      INSERT INTO environmental_alerts (id, fingerprint, type, severity, title, location, lat, lon, source, details, acknowledged, created_at)
      VALUES (@id, @fingerprint, @type, @severity, @title, @location, @lat, @lon, @source, @details, 0, @created_at)
      ON CONFLICT(fingerprint) DO UPDATE SET title = excluded.title, details = excluded.details
    `);

    // 1. High AQI alerts (> 150)
    for (const p of aq?.points ?? []) {
      if (p.usAqi != null && p.usAqi > 150) {
        const fingerprint = `aq-${p.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}`;
        insertStmt.run({
          id: crypto.randomUUID(),
          fingerprint,
          type: 'air_quality',
          severity: p.usAqi > 200 ? 'critical' : 'high',
          title: `Severe Air Quality Degradation: ${p.name}`,
          location: `${p.name}, ${p.country}`,
          lat: p.lat,
          lon: p.lon,
          source: 'Open-Meteo / CAMS',
          details: `US AQI reached ${p.usAqi} (${p.category}). PM2.5 concentration at ${p.pm25} µg/m³. Immediate outdoor exposure reduction advised.`,
          created_at: p.time || new Date().toISOString(),
        });
      }
    }

    // 2. High radiative power fire alerts (> 80 MW)
    for (const p of (fires?.points ?? []).slice(0, 20)) {
      if (p.frp > 80) {
        const fingerprint = `fire-${p.lat.toFixed(2)}-${p.lon.toFixed(2)}-${p.acquired || new Date().toISOString().slice(0, 10)}`;
        insertStmt.run({
          id: crypto.randomUUID(),
          fingerprint,
          type: 'fire_thermal',
          severity: p.frp > 120 ? 'critical' : 'high',
          title: `High Radiative Power Thermal Anomaly (${Math.round(p.frp)} MW)`,
          location: `${p.lat.toFixed(2)}°N, ${p.lon.toFixed(2)}°E`,
          lat: p.lat,
          lon: p.lon,
          source: fires.source || 'NASA FIRMS VIIRS',
          details: `Satellite ${p.satellite} detected high intensity fire cluster. Confidence: ${p.confidence}. Day/Night: ${p.daynight === 'D' ? 'Day' : 'Night'}.`,
          created_at: p.acquired ? `${p.acquired}T12:00:00Z` : new Date().toISOString(),
        });
      }
    }

    // 3. Critical Forest Loss Hotspots
    for (const p of def.points.filter((pt) => pt.severity === 'Critical')) {
      const fingerprint = `forest-${p.id}`;
      insertStmt.run({
        id: crypto.randomUUID(),
        fingerprint,
        type: 'forest_loss',
        severity: 'critical',
        title: `Critical Canopy Loss Front: ${p.name}`,
        location: `${p.name}, ${p.country}`,
        lat: p.lat,
        lon: p.lon,
        source: 'Global Forest Watch (Reference)',
        details: `Primary driver: ${p.driver}. Ecological biome: ${p.biome}. Accelerated loss trajectory documented.`,
        created_at: new Date().toISOString(),
      });
    }

    const rows = db.prepare('SELECT * FROM environmental_alerts ORDER BY acknowledged ASC, severity = "critical" DESC, created_at DESC').all() as EnvironmentalAlertRow[];
    return { alerts: rows, total: rows.length, unacknowledged: rows.filter((r) => !r.acknowledged).length };
  })
);

dataRouter.post(
  '/alerts/:id/acknowledge',
  requireAuth,
  wrap(async (req) => {
    const id = req.params.id;
    const alert = db.prepare('SELECT * FROM environmental_alerts WHERE id = ?').get(id) as EnvironmentalAlertRow | undefined;
    if (!alert) {
      return { ok: false, error: 'Alert not found' };
    }
    const newStatus = alert.acknowledged ? 0 : 1;
    db.prepare('UPDATE environmental_alerts SET acknowledged = ? WHERE id = ?').run(newStatus, id);
    return { ok: true, id, acknowledged: newStatus };
  })
);

dataRouter.get(
  '/history',
  requireAuth,
  wrap(async () => {
    const rows = db.prepare('SELECT * FROM environmental_snapshots ORDER BY created_at DESC LIMIT 30').all() as EnvironmentalSnapshotRow[];
    return { snapshots: rows };
  })
);

const summarySchema = z.object({
  name: z.string().trim().min(1).max(120),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI summary limit reached. Please wait a minute.' },
});

dataRouter.post('/ai/summary', requireAuth, aiLimiter, async (req, res) => {
  const parsed = summarySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Provide a name, lat and lon.' });
    return;
  }
  try {
    const ctx = await buildContext(parsed.data.name, parsed.data.lat, parsed.data.lon);
    const out = await summarise(ctx);
    res.json({ summary: out.text, source: out.source, context: ctx, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[ai]', err instanceof Error ? err.message : err);
    res.status(502).json({ error: 'Could not build the summary right now.' });
  }
});
