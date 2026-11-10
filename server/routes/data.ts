import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getFires } from '../data/fires.js';
import { getAirQuality, getAirQualityPoint } from '../data/airQuality.js';
import { getDeforestation } from '../data/deforestation.js';
import { getGfwForestAlerts, getGfwSyncStatus, syncGfwAlerts } from '../data/gfwIngestion.js';
import {
  buildContext,
  summarise,
  buildAiSummaryCacheKey,
  getCachedAiSummary,
  setCachedAiSummary,
  sanitizeErrorDetails,
  type AiSummaryTiming,
  type CachedAiSummaryPayload,
} from '../ai.js';
import { requireAuth } from './auth.js';
import { db, type EnvironmentalAlertRow, type EnvironmentalSnapshotRow, type GfwForestAlertRow } from '../db.js';
import { validateIndiaCoordinate, isPointInIndia } from '../data/geo.js';

export const dataRouter = Router();

const wrap =
  (fn: (req: import('express').Request) => Promise<unknown>) =>
  async (req: import('express').Request, res: import('express').Response) => {
    try {
      res.json(await fn(req));
    } catch (err) {
      console.error('[data]', req.path, err instanceof Error ? err.message : err);
      const status = typeof (err as { statusCode?: number })?.statusCode === 'number'
        ? (err as { statusCode: number }).statusCode
        : 502;
      const message = status === 400 && err instanceof Error
        ? err.message
        : 'Upstream data source unavailable. Please try again shortly.';
      res.status(status).json({ error: message });
    }
  };

dataRouter.get(
  '/fires',
  requireAuth,
  wrap(async (req) => {
    const days = req.query.days ? Number(req.query.days) : 1;
    const source = typeof req.query.source === 'string' ? req.query.source : undefined;
    const bbox = typeof req.query.bbox === 'string' ? req.query.bbox : undefined;
    return getFires({ days, source, bbox });
  })
);

dataRouter.get(
  '/air-quality',
  requireAuth,
  wrap(async (req) => {
    const latParam = req.query.lat as string | undefined;
    const lonParam = req.query.lon as string | undefined;
    if (latParam !== undefined && lonParam !== undefined) {
      const lat = Number(latParam);
      const lon = Number(lonParam);
      const name = typeof req.query.name === 'string' ? req.query.name : undefined;
      return getAirQualityPoint(lat, lon, name);
    }
    return getAirQuality();
  })
);

dataRouter.get(
  '/air-quality/point',
  requireAuth,
  wrap(async (req) => {
    const latParam = req.query.lat as string | undefined;
    const lonParam = req.query.lon as string | undefined;
    if (latParam === undefined || lonParam === undefined || latParam.trim() === '' || lonParam.trim() === '') {
      const err = new Error('Missing required query parameters: latitude (lat) and longitude (lon).');
      (err as unknown as { statusCode: number }).statusCode = 400;
      throw err;
    }
    const lat = Number(latParam);
    const lon = Number(lonParam);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      const err = new Error('Latitude and longitude parameters must be valid numeric coordinates.');
      (err as unknown as { statusCode: number }).statusCode = 400;
      throw err;
    }
    validateIndiaCoordinate(lat, lon);
    const name = typeof req.query.name === 'string' ? req.query.name : undefined;
    return getAirQualityPoint(lat, lon, name);
  })
);

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

    const def = getDeforestation();

    return {
      fires: { total: fires.total, shown: fires.points.length, live: fires.live, source: fires.source, fetchedAt: fires.fetchedAt },
      airQuality: {
        stations: valid.length,
        virtualObservatories: valid.length,
        unhealthy: valid.filter((p) => (p.usAqi ?? 0) > 150).length,
        worst: worst ? { name: worst.name, country: worst.country, usAqi: worst.usAqi, category: worst.category } : null,
        available: !!aq,
        fetchedAt: aq?.fetchedAt ?? null,
        modelled: true,
        type: 'Copernicus Atmospheric Monitoring Service (CAMS) Modelled Reanalysis Grid',
      },
      deforestation: {
        hotspots: def.points.length,
        curatedReserves: def.curatedReserves.length,
        liveAlerts: def.liveAlerts.length,
        live: def.live,
        status: def.syncStatus.status,
      },
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
        const isHazard = p.usAqi > 200;
        insertStmt.run({
          id: crypto.randomUUID(),
          fingerprint,
          type: 'air_quality',
          severity: isHazard ? 'critical' : 'high',
          title: isHazard ? `Severe Air Quality Hazard: ${p.name}` : `Unhealthy Air Quality Advisory: ${p.name}`,
          location: `${p.name}, ${p.country}`,
          lat: p.lat,
          lon: p.lon,
          source: 'Open-Meteo / Copernicus CAMS Model',
          details: `Copernicus CAMS atmospheric dispersion model indicates US AQI at ${p.usAqi} (${p.category}) with PM2.5 at ${p.pm25 ?? 'n/a'} µg/m³. Model simulation advisory: recommend outdoor exposure reduction.`,
          created_at: p.time || new Date().toISOString(),
        });
      }
    }

    // 2. High radiative power fire alerts (> 80 MW)
    // Clearly distinguishes sensor thermal anomaly observation from ground disaster classification
    for (const p of (fires?.points ?? []).slice(0, 20)) {
      if (p.frp > 80) {
        const fingerprint = `fire-${p.lat.toFixed(2)}-${p.lon.toFixed(2)}-${p.acquired || new Date().toISOString().slice(0, 10)}`;
        const isExtreme = p.frp > 150;
        insertStmt.run({
          id: crypto.randomUUID(),
          fingerprint,
          type: 'fire_thermal',
          severity: isExtreme ? 'critical' : 'high',
          title: isExtreme
            ? `Severe Thermal Radiative Cluster (${Math.round(p.frp)} MW)`
            : `High Radiative Thermal Anomaly (${Math.round(p.frp)} MW)`,
          location: `${p.lat.toFixed(2)}°N, ${p.lon.toFixed(2)}°E`,
          lat: p.lat,
          lon: p.lon,
          source: fires.source || 'NASA FIRMS VIIRS',
          details: `Satellite sensor ${p.satellite} detected high-intensity 375m thermal pixel (${Math.round(p.frp)} MW, confidence: ${p.confidence}). Day/Night: ${p.daynight === 'D' ? 'Day' : 'Night'}. Note: Satellite thermal anomaly observation, requires ground verification.`,
          created_at: p.acquired ? `${p.acquired}T12:00:00Z` : new Date().toISOString(),
        });
      }
    }

    // 3. Live GFW Ingested Forest Alerts (if available)
    const liveGfwAlerts = getGfwForestAlerts(20);
    for (const g of liveGfwAlerts) {
      if (g.confidence === 'high') {
        const fingerprint = `forest-gfw-${g.alert_id}`;
        insertStmt.run({
          id: crypto.randomUUID(),
          fingerprint,
          type: 'forest_loss',
          severity: 'critical',
          title: `GFW Verified Canopy Loss Alert (${g.area_ha ? g.area_ha.toFixed(1) + ' ha' : 'Active Cluster'})`,
          location: `${g.latitude.toFixed(2)}°N, ${g.longitude.toFixed(2)}°E`,
          lat: g.latitude,
          lon: g.longitude,
          source: 'Global Forest Watch (Integrated NRT)',
          details: `Satellite deforestation alert confirmed on ${g.alert_date} (confidence: ${g.confidence}). Area disturbance: ${g.area_ha ? g.area_ha.toFixed(1) + ' ha' : 'Grid pixel loss'}.`,
          created_at: `${g.alert_date}T12:00:00Z`,
        });
      }
    }

    // 4. Critical Forest Loss Hotspots (Curated Reference Dataset)
    for (const p of def.points.filter((pt) => pt.severity === 'Critical')) {
      const fingerprint = `forest-${p.id}`;
      insertStmt.run({
        id: crypto.randomUUID(),
        fingerprint,
        type: 'forest_loss',
        severity: 'critical',
        title: `Reference Loss Front: ${p.name}`,
        location: `${p.name}, ${p.country}`,
        lat: p.lat,
        lon: p.lon,
        source: 'Global Forest Watch (Curated Reference Dataset)',
        details: `Primary driver: ${p.driver}. Ecological biome: ${p.biome}. Note: Curated baseline reference catalog documenting multi-year landscape pressure.`,
        created_at: new Date().toISOString(),
      });
    }

    const rows = db
      .prepare(
        "SELECT * FROM environmental_alerts WHERE lat >= 6.5 AND lat <= 37.5 AND lon >= 68.0 AND lon <= 97.5 ORDER BY acknowledged ASC, severity = 'critical' DESC, created_at DESC"
      )
      .all() as EnvironmentalAlertRow[];
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
  wrap(async (req) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 5), 100);
    const since = req.query.since ? Number(req.query.since) : 0;
    const rows = db
      .prepare('SELECT * FROM environmental_snapshots WHERE created_at >= ? ORDER BY created_at ASC LIMIT ?')
      .all(since, limit) as EnvironmentalSnapshotRow[];
    return { snapshots: rows, count: rows.length };
  })
);

dataRouter.get(
  '/gfw/alerts',
  requireAuth,
  wrap(async () => {
    const syncStatus = getGfwSyncStatus();
    const liveAlerts = getGfwForestAlerts(100);
    const def = getDeforestation();
    return {
      liveAlerts,
      syncStatus,
      referenceHotspots: def.points,
      liveCount: liveAlerts.length,
      referenceCount: def.points.length,
      source: 'Global Forest Watch Data API',
    };
  })
);

dataRouter.post(
  '/gfw/sync',
  requireAuth,
  wrap(async () => {
    const status = await syncGfwAlerts(true);
    return { ok: status.status === 'success', syncStatus: status };
  })
);

const summarySchema = z.object({
  name: z.string().trim().min(1).max(120),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  radiusKm: z.number().min(10).max(500).optional(),
  briefType: z.enum(['standard', 'detailed', 'risk']).optional(),
  bypassCache: z.boolean().optional(),
});

const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI summary limit reached. Please wait a minute.' },
});

dataRouter.post('/ai/summary', requireAuth, aiLimiter, async (req, res) => {
  const tStart = performance.now();
  const parsed = summarySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Provide a name, lat and lon.' });
    return;
  }
  if (!isPointInIndia(parsed.data.lat, parsed.data.lon)) {
    res.status(400).json({
      error: `ATmosIQ AI environmental analysis is restricted exclusively to locations within India. Requested coordinates (${parsed.data.lat.toFixed(4)}°, ${parsed.data.lon.toFixed(4)}°) are outside Indian sovereign territory.`,
    });
    return;
  }

  const radiusKm = parsed.data.radiusKm ?? 150;
  const briefType = parsed.data.briefType ?? 'standard';
  const dataFreshnessToken = Math.floor(Date.now() / (3 * 60 * 1000)); // 3-minute freshness window

  const cacheKey = buildAiSummaryCacheKey({
    lat: parsed.data.lat,
    lon: parsed.data.lon,
    radiusKm,
    dataFreshness: dataFreshnessToken,
    briefType,
  });

  if (!parsed.data.bypassCache) {
    const cached = getCachedAiSummary(cacheKey);
    if (cached) {
      const totalMs = Math.round(performance.now() - tStart);
      const timing: AiSummaryTiming = {
        dataRetrievalMs: 0,
        geminiMs: 0,
        backoffMs: 0,
        fallbackMs: 0,
        totalMs,
        cached: true,
      };

      console.log(
        `[ai-perf] Location: "${sanitizeErrorDetails(parsed.data.name)}" | Total: ${totalMs}ms | Data: 0ms | Gemini: 0ms | Backoff: 0ms | Fallback: 0ms | Source: ${cached.source} | Cached: true`
      );

      res.setHeader('Server-Timing', `total;dur=${totalMs}, cached;dur=1`);
      res.json({
        summary: cached.summary,
        source: cached.source,
        fallback: cached.fallback,
        fallbackReason: cached.fallbackReason,
        context: cached.context,
        generatedAt: cached.generatedAt,
        timing,
        cacheKey,
      });
      return;
    }
  }

  try {
    const tRetrievalStart = performance.now();
    const ctx = await buildContext(parsed.data.name, parsed.data.lat, parsed.data.lon, radiusKm);
    const dataRetrievalMs = Math.round(performance.now() - tRetrievalStart);

    const out = await summarise(ctx);
    const totalMs = Math.round(performance.now() - tStart);

    const timing: AiSummaryTiming = {
      dataRetrievalMs,
      geminiMs: out.timing?.geminiMs ?? 0,
      backoffMs: out.timing?.backoffMs ?? 0,
      fallbackMs: out.timing?.fallbackMs ?? 0,
      totalMs,
      cached: false,
    };

    console.log(
      `[ai-perf] Location: "${sanitizeErrorDetails(parsed.data.name)}" | Total: ${totalMs}ms | Data: ${dataRetrievalMs}ms | Gemini: ${timing.geminiMs}ms | Backoff: ${timing.backoffMs}ms | Fallback: ${timing.fallbackMs}ms | Source: ${out.source} | Cached: false`
    );

    res.setHeader(
      'Server-Timing',
      `total;dur=${totalMs}, data;dur=${dataRetrievalMs}, gemini;dur=${timing.geminiMs}, backoff;dur=${timing.backoffMs}, fallback;dur=${timing.fallbackMs}`
    );

    const responsePayload: CachedAiSummaryPayload = {
      summary: out.text,
      source: out.source,
      fallback: !!out.fallback,
      fallbackReason: out.fallbackReason,
      context: ctx,
      generatedAt: new Date().toISOString(),
      cacheKey,
      timing,
    };

    // Only cache successful Gemini AI responses; never cache fallback responses so retries can succeed immediately
    if (!out.fallback && out.source === 'gemini') {
      setCachedAiSummary(cacheKey, responsePayload);
    }
    res.json(responsePayload);
  } catch (err) {
    console.error('[ai]', err instanceof Error ? err.message : err);
    res.status(502).json({ error: 'Could not build the summary right now.' });
  }
});
