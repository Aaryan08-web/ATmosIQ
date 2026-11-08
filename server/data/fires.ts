import { config } from '../config.js';
import { cached } from './cache.js';

export interface FirePoint {
  lat: number;
  lon: number;
  frp: number; // fire radiative power, MW
  confidence: string;
  acquired: string; // ISO-ish date + time (UTC)
  satellite: string;
  daynight: string;
}

export interface FireResult {
  points: FirePoint[];
  total: number; // before downsampling
  source: string;
  live: boolean;
  fetchedAt: string;
}

const MAX_POINTS = 4000;

function parseCsv(csv: string): FirePoint[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(',');
  const idx = (name: string) => header.indexOf(name);
  const iLat = idx('latitude'), iLon = idx('longitude'), iFrp = idx('frp');
  const iConf = idx('confidence'), iDate = idx('acq_date'), iTime = idx('acq_time');
  const iSat = idx('satellite'), iDn = idx('daynight');
  if (iLat < 0 || iLon < 0) throw new Error('Unexpected FIRMS response format');
  const out: FirePoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    const lat = Number(c[iLat]), lon = Number(c[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const t = (c[iTime] ?? '').padStart(4, '0');
    out.push({
      lat,
      lon,
      frp: Number(c[iFrp]) || 0,
      confidence: c[iConf] ?? '',
      acquired: `${c[iDate]} ${t.slice(0, 2)}:${t.slice(2)} UTC`,
      satellite: c[iSat] ?? '',
      daynight: c[iDn] ?? '',
    });
  }
  return out;
}

/** Deterministic sample used ONLY when no FIRMS key is configured. Clearly flagged live:false. */
function sampleFires(): FireResult {
  const clusters: [number, number, number][] = [
    [-9.5, -62.5, 60], [-3.2, 22.5, 50], [-14.8, 28.1, 40], [30.9, 75.5, 45],
    [21.2, 81.4, 35], [-31.5, 148.2, 30], [38.5, -121.4, 25], [61.5, 105.3, 30],
  ];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const points: FirePoint[] = [];
  for (const [lat, lon, n] of clusters) {
    for (let i = 0; i < n; i++) {
      points.push({
        lat: lat + (rnd() - 0.5) * 4,
        lon: lon + (rnd() - 0.5) * 4,
        frp: Math.round(rnd() * 80 * 10) / 10,
        confidence: 'n',
        acquired: 'sample data',
        satellite: 'N/A',
        daynight: 'D',
      });
    }
  }
  return {
    points,
    total: points.length,
    source: 'Sample data (set FIRMS_MAP_KEY for live NASA FIRMS detections)',
    live: false,
    fetchedAt: new Date().toISOString(),
  };
}

async function loadFires(days: number): Promise<FireResult> {
  if (!config.firmsKey) return sampleFires();
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${config.firmsKey}/VIIRS_SNPP_NRT/world/${days}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`NASA FIRMS responded ${res.status}`);
  const text = await res.text();
  if (text.startsWith('Invalid') || text.includes('<html')) throw new Error('NASA FIRMS rejected the request (check FIRMS_MAP_KEY)');
  const all = parseCsv(text).filter((p) => p.confidence !== 'l'); // drop low-confidence VIIRS detections
  const points = all.sort((a, b) => b.frp - a.frp).slice(0, MAX_POINTS);
  return {
    points,
    total: all.length,
    source: 'NASA FIRMS · VIIRS S-NPP NRT',
    live: true,
    fetchedAt: new Date().toISOString(),
  };
}

export function getFires(days = 1): Promise<FireResult> {
  const d = Math.min(Math.max(Math.round(days), 1), 5);
  return cached(`fires:${d}`, 15 * 60 * 1000, () => loadFires(d));
}
