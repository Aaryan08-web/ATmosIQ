import crypto from 'node:crypto';
import { config } from '../config.js';
import { db, type GfwSyncStatusRow, type GfwForestAlertRow, type EnvironmentalAlertRow } from '../db.js';
import { isPointInIndia } from './geo.js';

const GFW_BASE_URL = 'https://data-api.globalforestwatch.org';
const GFW_DATASET = 'gfw_integrated_alerts';
const GFW_VERSION = 'latest';

let isSyncing = false;

export function getGfwSyncStatus(): GfwSyncStatusRow {
  const row = db.prepare('SELECT * FROM gfw_sync_status WHERE id = ?').get('gfw_integrated_alerts') as
    | GfwSyncStatusRow
    | undefined;

  if (row) return row;

  // Initialize initial row
  const initial: GfwSyncStatusRow = {
    id: 'gfw_integrated_alerts',
    last_attempt_at: new Date(0).toISOString(),
    last_success_at: null,
    status: config.gfwKey ? 'idle' : 'unavailable',
    records_ingested: 0,
    error_message: config.gfwKey ? null : 'No GFW_API_KEY configured in environment.',
  };

  db.prepare(`
    INSERT INTO gfw_sync_status (id, last_attempt_at, last_success_at, status, records_ingested, error_message)
    VALUES (@id, @last_attempt_at, @last_success_at, @status, @records_ingested, @error_message)
    ON CONFLICT(id) DO NOTHING
  `).run(initial);

  return initial;
}

export function updateGfwSyncStatus(updates: Partial<GfwSyncStatusRow>) {
  const current = getGfwSyncStatus();
  const merged: GfwSyncStatusRow = {
    ...current,
    ...updates,
    last_attempt_at: updates.last_attempt_at || new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO gfw_sync_status (id, last_attempt_at, last_success_at, status, records_ingested, error_message)
    VALUES (@id, @last_attempt_at, @last_success_at, @status, @records_ingested, @error_message)
    ON CONFLICT(id) DO UPDATE SET
      last_attempt_at = excluded.last_attempt_at,
      last_success_at = excluded.last_success_at,
      status = excluded.status,
      records_ingested = excluded.records_ingested,
      error_message = excluded.error_message
  `).run(merged);

  return merged;
}

export interface GfwQueryResult {
  data?: {
    latitude: number;
    longitude: number;
    gfw_integrated_alerts__date: string;
    gfw_integrated_alerts__confidence?: string;
    confidence?: string;
    area__ha?: number;
  }[];
  status?: string;
  message?: string;
}

export interface IndianForestAoi {
  id: string;
  name: string;
  state: string;
  geometry: {
    type: 'Polygon';
    coordinates: [number, number][][];
  };
}

/**
 * Authoritative Indian Forest Areas of Interest (AOIs) for GFW Near-Real-Time Surveillance.
 * Sized appropriately (~40 km x 40 km) to prevent upstream GFW raster processing timeouts.
 */
export const INDIAN_FOREST_AOIS: IndianForestAoi[] = [
  // 1. Western Ghats (Southern)
  {
    id: 'in-aoi-western-ghats-nilgiri',
    name: 'Western Ghats · Nilgiri & Wayanad Corridor',
    state: 'Kerala / Karnataka / Tamil Nadu',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [76.2, 11.3],
          [76.6, 11.3],
          [76.6, 11.7],
          [76.2, 11.7],
          [76.2, 11.3],
        ],
      ],
    },
  },
  // 2. Western Ghats (Northern)
  {
    id: 'in-aoi-western-ghats-koyna',
    name: 'Western Ghats · Koyna-Mahabaleshwar Corridor',
    state: 'Maharashtra',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [73.5, 17.5],
          [73.9, 17.5],
          [73.9, 17.9],
          [73.5, 17.9],
          [73.5, 17.5],
        ],
      ],
    },
  },
  // 3. Western Ghats (Anamalai-Periyar)
  {
    id: 'in-aoi-western-ghats-anamalai',
    name: 'Western Ghats · Anamalai & Periyar Corridor',
    state: 'Kerala / Tamil Nadu',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [76.8, 9.8],
          [77.2, 9.8],
          [77.2, 10.2],
          [76.8, 10.2],
          [76.8, 9.8],
        ],
      ],
    },
  },
  // 4. Sundarbans Mangrove Delta
  {
    id: 'in-aoi-sundarbans',
    name: 'Sundarbans Mangrove Delta',
    state: 'West Bengal',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [88.6, 21.8],
          [89.0, 21.8],
          [89.0, 22.2],
          [88.6, 22.2],
          [88.6, 21.8],
        ],
      ],
    },
  },
  // 5. Northeast India (Karbi Anglong / Kaziranga)
  {
    id: 'in-aoi-karbi-anglong',
    name: 'Karbi Anglong & Kaziranga Foothills',
    state: 'Assam',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [93.0, 26.0],
          [93.4, 26.0],
          [93.4, 26.4],
          [93.0, 26.4],
          [93.0, 26.0],
        ],
      ],
    },
  },
  // 6. Northeast India (Mizoram Tropical Forest)
  {
    id: 'in-aoi-dampa-mizoram',
    name: 'Dampa & Western Mizoram Hills',
    state: 'Mizoram',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [92.2, 23.4],
          [92.6, 23.4],
          [92.6, 23.8],
          [92.2, 23.8],
          [92.2, 23.4],
        ],
      ],
    },
  },
  // 7. Central Indian Corridor (Satpura-Maikal)
  {
    id: 'in-aoi-satpura-maikal',
    name: 'Central Indian Satpura-Maikal Corridor',
    state: 'Madhya Pradesh',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [80.3, 22.1],
          [80.7, 22.1],
          [80.7, 22.5],
          [80.3, 22.5],
          [80.3, 22.1],
        ],
      ],
    },
  },
  // 8. Central Indian Forests (Bastar / Dandakaranya)
  {
    id: 'in-aoi-bastar-dandakaranya',
    name: 'Bastar & Dandakaranya Dense Forest',
    state: 'Chhattisgarh',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [81.0, 19.0],
          [81.4, 19.0],
          [81.4, 19.4],
          [81.0, 19.4],
          [81.0, 19.0],
        ],
      ],
    },
  },
  // 9. Eastern Indian Forests (Saranda Sal Belt)
  {
    id: 'in-aoi-saranda-sal',
    name: 'Saranda Dense Sal Forest Belt',
    state: 'Jharkhand / Odisha',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [85.1, 22.1],
          [85.5, 22.1],
          [85.5, 22.5],
          [85.1, 22.5],
          [85.1, 22.1],
        ],
      ],
    },
  },
  // 10. Eastern Indian Forests (Similipal Biosphere)
  {
    id: 'in-aoi-similipal-biosphere',
    name: 'Similipal Biosphere Reserve Core',
    state: 'Odisha',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [86.1, 21.6],
          [86.5, 21.6],
          [86.5, 22.0],
          [86.1, 22.0],
          [86.1, 21.6],
        ],
      ],
    },
  },
  // 11. Himalayan Forest Belt (Rajaji-Corbett Shivaliks)
  {
    id: 'in-aoi-corbett-shivaliks',
    name: 'Rajaji-Corbett Sub-Himalayan Shivaliks',
    state: 'Uttarakhand',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [78.8, 29.4],
          [79.2, 29.4],
          [79.2, 29.8],
          [78.8, 29.8],
          [78.8, 29.4],
        ],
      ],
    },
  },
  // 12. Island Ecosystem (Great Nicobar Biosphere)
  {
    id: 'in-aoi-great-nicobar',
    name: 'Great Nicobar Biosphere Reserve',
    state: 'Andaman & Nicobar Islands',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [93.7, 6.8],
          [94.0, 6.8],
          [94.0, 7.2],
          [93.7, 7.2],
          [93.7, 6.8],
        ],
      ],
    },
  },
];

/**
 * Background ingestion worker for Global Forest Watch in India.
 * Queries GFW Data API across verified Indian Forest AOIs, filters points strictly
 * within Indian sovereign territory, deduplicates records, and persists to SQLite.
 */
export async function syncGfwAlerts(force = false): Promise<GfwSyncStatusRow> {
  if (isSyncing) {
    return getGfwSyncStatus();
  }

  if (!config.gfwKey) {
    return updateGfwSyncStatus({
      status: 'unavailable',
      error_message: 'No GFW_API_KEY configured in environment.',
    });
  }

  const current = getGfwSyncStatus();
  const now = Date.now();
  const lastAttemptTime = new Date(current.last_attempt_at).getTime();

  // Rate-limit sync executions: don't sync more frequently than every 15 minutes unless forced
  if (!force && current.status === 'success' && now - lastAttemptTime < 15 * 60 * 1000) {
    return current;
  }

  isSyncing = true;
  updateGfwSyncStatus({ status: 'running', error_message: null });

  try {
    const insertAlertStmt = db.prepare(`
      INSERT INTO gfw_forest_alerts (
        id, alert_id, dataset, version, latitude, longitude, area_ha,
        confidence, alert_date, location_name, source, retrieved_at, created_at
      ) VALUES (
        @id, @alert_id, @dataset, @version, @latitude, @longitude, @area_ha,
        @confidence, @alert_date, @location_name, @source, @retrieved_at, @created_at
      )
      ON CONFLICT(alert_id) DO UPDATE SET
        area_ha = excluded.area_ha,
        confidence = excluded.confidence,
        retrieved_at = excluded.retrieved_at
    `);

    const insertUnifiedAlertStmt = db.prepare(`
      INSERT INTO environmental_alerts (
        id, fingerprint, type, severity, title, location, lat, lon, source, details, acknowledged, created_at
      ) VALUES (
        @id, @fingerprint, @type, @severity, @title, @location, @lat, @lon, @source, @details, 0, @created_at
      )
      ON CONFLICT(fingerprint) DO UPDATE SET
        details = excluded.details,
        severity = excluded.severity
    `);

    let totalIngestedCount = 0;
    const retrievedAt = new Date().toISOString();
    const sqlQuery = `SELECT latitude, longitude, gfw_integrated_alerts__date, gfw_integrated_alerts__confidence FROM results ORDER BY gfw_integrated_alerts__date DESC LIMIT 50`;
    const url = `${GFW_BASE_URL}/dataset/${GFW_DATASET}/${GFW_VERSION}/query/json`;

    const gfwReferer = config.gfwOrigin.endsWith('/') ? config.gfwOrigin : `${config.gfwOrigin}/`;

    // Query each Indian AOI sequentially to avoid bursting GFW rate limits
    for (const aoi of INDIAN_FOREST_AOIS) {
      try {
        let attempts = 0;
        let res: Response | null = null;

        while (attempts < 2) {
          attempts++;
          try {
            res = await fetch(url, {
              method: 'POST',
              headers: {
                'x-api-key': config.gfwKey,
                'Origin': config.gfwOrigin,
                'Referer': gfwReferer,
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({
                geometry: aoi.geometry,
                sql: sqlQuery,
              }),
              signal: AbortSignal.timeout(20_000),
            });

            // If transient server error (502, 503, 504), retry once after a short delay
            if (res.status >= 500 && attempts < 2) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            }
            break;
          } catch (fetchErr) {
            if (attempts >= 2) throw fetchErr;
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        if (!res) continue;

        if (res.status === 401 || res.status === 403) {
          isSyncing = false;
          return updateGfwSyncStatus({
            status: 'unauthorized',
            error_message: `GFW API authorization rejected (${res.status}) for origin '${config.gfwOrigin}'. Ensure domain is registered in the WRI Developer Portal allowlist.`,
          });
        }

        if (res.status === 429) {
          console.warn(`[gfw-worker] AOI ${aoi.name} rate limited (HTTP 429).`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }

        if (!res.ok) {
          console.warn(`[gfw-worker] AOI ${aoi.name} responded with HTTP ${res.status}`);
          continue;
        }

        // Brief delay between successful AOI queries to prevent rate-limit throttling
        await new Promise((resolve) => setTimeout(resolve, 200));

        const json = (await res.json()) as GfwQueryResult;
        const records = json.data ?? [];

        if (Array.isArray(records)) {
          for (const r of records) {
            const lat = Number(r.latitude);
            const lon = Number(r.longitude);

            // Strict geographic validation: must be finite and within India's boundary
            if (!Number.isFinite(lat) || !Number.isFinite(lon) || !isPointInIndia(lat, lon)) {
              continue;
            }

            const dateStr = r.gfw_integrated_alerts__date || new Date().toISOString().slice(0, 10);
            const conf = (r.gfw_integrated_alerts__confidence || r.confidence || 'nominal').toLowerCase();
            const confidence = conf === 'highest' || conf === 'high' ? 'high' : conf === 'low' ? 'low' : 'nominal';
            const areaHa = typeof r.area__ha === 'number' ? r.area__ha : null;
            const alertId = `gfw-${lat.toFixed(3)}-${lon.toFixed(3)}-${dateStr}`;

            const row: GfwForestAlertRow = {
              id: crypto.randomUUID(),
              alert_id: alertId,
              dataset: GFW_DATASET,
              version: GFW_VERSION,
              latitude: lat,
              longitude: lon,
              area_ha: areaHa,
              confidence,
              alert_date: dateStr,
              location_name: `${aoi.name} (${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E)`,
              source: 'Global Forest Watch · Integrated NRT (India)',
              retrieved_at: retrievedAt,
              created_at: now,
            };

            insertAlertStmt.run(row);
            totalIngestedCount++;

            // If high confidence alert, create unified environmental alert
            if (confidence === 'high') {
              insertUnifiedAlertStmt.run({
                id: crypto.randomUUID(),
                fingerprint: `forest-gfw-${alertId}`,
                type: 'forest_loss',
                severity: 'critical',
                title: `GFW Verified Canopy Disturbance · ${aoi.name}`,
                location: `${aoi.state} (${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E)`,
                lat,
                lon,
                source: 'Global Forest Watch (Integrated NRT)',
                details: `Satellite sensor detected high-confidence canopy disturbance (${dateStr}) in ${aoi.name}. Area footprint: ${areaHa ? areaHa.toFixed(1) + ' ha' : 'Grid pixel loss'}.`,
                created_at: `${dateStr}T12:00:00Z`,
              });
            }
          }
        }
      } catch (aoiErr) {
        console.warn(`[gfw-worker] Error querying AOI ${aoi.name}:`, aoiErr instanceof Error ? aoiErr.message : aoiErr);
      }
    }

    isSyncing = false;
    return updateGfwSyncStatus({
      status: 'success',
      last_success_at: retrievedAt,
      records_ingested: totalIngestedCount,
      error_message: null,
    });
  } catch (err) {
    isSyncing = false;
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gfw-worker]', msg);
    return updateGfwSyncStatus({
      status: 'failed',
      error_message: `GFW synchronization failed: ${msg}`,
    });
  }
}

export function getGfwForestAlerts(limit = 100): GfwForestAlertRow[] {
  // Return alerts strictly within India's geographic bounds
  return db
    .prepare(
      'SELECT * FROM gfw_forest_alerts WHERE latitude >= 6.5 AND latitude <= 37.5 AND longitude >= 68.0 AND longitude <= 97.5 ORDER BY alert_date DESC, created_at DESC LIMIT ?'
    )
    .all(limit) as GfwForestAlertRow[];
}

let schedulerTimer: NodeJS.Timeout | null = null;
let initialTimeout: NodeJS.Timeout | null = null;

export function startGfwScheduler(intervalMinutes?: number) {
  if (schedulerTimer) {
    return;
  }

  const mins = intervalMinutes || config.gfwSyncIntervalMinutes || 360;
  const intervalMs = Math.max(mins, 15) * 60 * 1000;

  console.log(`[gfw-scheduler] Ingestion scheduler initialized for Indian Forest AOIs (interval: ${mins} minutes).`);

  initialTimeout = setTimeout(() => {
    syncGfwAlerts().catch((err) => {
      console.error('[gfw-scheduler] Initial synchronization error:', err);
    });
  }, 10_000);

  schedulerTimer = setInterval(() => {
    syncGfwAlerts().catch((err) => {
      console.error('[gfw-scheduler] Scheduled periodic synchronization error:', err);
    });
  }, intervalMs);

  initialTimeout.unref();
  schedulerTimer.unref();
}

export function stopGfwScheduler() {
  if (initialTimeout) {
    clearTimeout(initialTimeout);
    initialTimeout = null;
  }
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log('[gfw-scheduler] Ingestion scheduler stopped.');
  }
}
