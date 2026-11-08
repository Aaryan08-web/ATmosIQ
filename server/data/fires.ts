import { config } from '../config.js';
import { cached } from './cache.js';
import { INDIA_BOUNDING_BOX, INDIA_BBOX_STRING, isPointInIndia, type BoundingBox } from './geo.js';

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
  isDemo?: boolean;
  status?: 'live' | 'sample';
  fetchedAt: string;
  bbox?: [number, number, number, number] | null;
}

export const FIRMS_SOURCES = {
  VIIRS_NOAA20_NRT: {
    id: 'VIIRS_NOAA20_NRT',
    name: 'NASA FIRMS · VIIRS NOAA-20 NRT (375m)',
    instrument: 'VIIRS',
    satellite: 'NOAA-20',
    resolution: '375m',
  },
  VIIRS_NOAA21_NRT: {
    id: 'VIIRS_NOAA21_NRT',
    name: 'NASA FIRMS · VIIRS NOAA-21 NRT (375m)',
    instrument: 'VIIRS',
    satellite: 'NOAA-21',
    resolution: '375m',
  },
  VIIRS_SNPP_NRT: {
    id: 'VIIRS_SNPP_NRT',
    name: 'NASA FIRMS · VIIRS S-NPP NRT (375m)',
    instrument: 'VIIRS',
    satellite: 'Suomi-NPP',
    resolution: '375m',
  },
  MODIS_NRT: {
    id: 'MODIS_NRT',
    name: 'NASA FIRMS · MODIS Aqua/Terra NRT (1km)',
    instrument: 'MODIS',
    satellite: 'Aqua / Terra',
    resolution: '1km',
  },
} as const;

export type FirmsSourceKey = keyof typeof FIRMS_SOURCES;
export const DEFAULT_SOURCE_KEY: FirmsSourceKey = 'VIIRS_NOAA20_NRT';

export interface FireQueryOptions {
  days?: number;
  source?: FirmsSourceKey | string;
  bbox?: BoundingBox | [number, number, number, number] | string;
}

const MAX_POINTS = 4000;

export function parseBoundingBox(
  bbox: BoundingBox | [number, number, number, number] | string | undefined
): BoundingBox | null {
  if (!bbox) return null;
  let minLon: number, minLat: number, maxLon: number, maxLat: number;

  if (typeof bbox === 'string') {
    const parts = bbox.split(',').map((p) => Number(p.trim()));
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
      throw new Error('Invalid bounding box format. Expected "minLon,minLat,maxLon,maxLat" as 4 numeric coordinates.');
    }
    [minLon, minLat, maxLon, maxLat] = parts;
  } else if (Array.isArray(bbox)) {
    if (bbox.length !== 4 || bbox.some((n) => !Number.isFinite(n))) {
      throw new Error('Invalid bounding box array. Expected [minLon, minLat, maxLon, maxLat].');
    }
    [minLon, minLat, maxLon, maxLat] = bbox;
  } else {
    minLon = bbox.minLon;
    minLat = bbox.minLat;
    maxLon = bbox.maxLon;
    maxLat = bbox.maxLat;
  }

  if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90) {
    throw new Error('Bounding box coordinates out of bounds: longitude must be [-180, 180], latitude [-90, 90].');
  }
  if (minLon > maxLon) {
    throw new Error('Invalid bounding box: minLon cannot be greater than maxLon.');
  }
  if (minLat > maxLat) {
    throw new Error('Invalid bounding box: minLat cannot be greater than maxLat.');
  }

  return { minLon, minLat, maxLon, maxLat };
}

function isLowConfidence(conf: string): boolean {
  if (conf === 'l') return true;
  const num = Number(conf);
  if (Number.isFinite(num) && num < 30) return true;
  return false;
}

function parseCsv(csv: string): FirePoint[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(',');
  const idx = (name: string) => header.indexOf(name);
  const iLat = idx('latitude'),
    iLon = idx('longitude'),
    iFrp = idx('frp');
  const iConf = idx('confidence'),
    iDate = idx('acq_date'),
    iTime = idx('acq_time');
  const iSat = idx('satellite'),
    iDn = idx('daynight');
  if (iLat < 0 || iLon < 0) throw new Error('Unexpected FIRMS response format');
  const out: FirePoint[] = [];

  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    const lat = Number(c[iLat]),
      lon = Number(c[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    // Strict India boundary filtering: discard any detection outside sovereign Indian territory
    if (!isPointInIndia(lat, lon)) continue;

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

/**
 * Deterministic Indian thermal sample used ONLY when no FIRMS_MAP_KEY is configured.
 * All sample clusters are located strictly in documented Indian agricultural/forest fire hotspots.
 * Clearly flagged live: false.
 */
function sampleFires(bbox?: BoundingBox | null): FireResult {
  // Authoritative Indian fire regime hotspots:
  // [Lat, Lon, Count]
  const clusters: [number, number, number][] = [
    [30.9, 75.8, 65], // Punjab / Haryana agricultural post-harvest residue
    [22.2, 81.2, 50], // Central India deciduous forest fires (Chhattisgarh / MP)
    [21.8, 86.2, 40], // Similipal Biosphere deciduous fire buffer (Odisha)
    [14.5, 75.5, 35], // Karnataka / Western Ghats dry deciduous margin
    [25.5, 93.0, 30], // Northeast India seasonal agricultural clearance
    [17.8, 79.5, 30], // Telangana / Andhra Pradesh deciduous forest belt
    [24.5, 74.0, 25], // Rajasthan Aravalli dry thorn forest zone
    [26.5, 82.5, 35], // Indo-Gangetic agricultural residue clusters (UP)
  ];

  let seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let points: FirePoint[] = [];

  for (const [lat, lon, n] of clusters) {
    for (let i = 0; i < n; i++) {
      const pLat = lat + (rnd() - 0.5) * 1.2;
      const pLon = lon + (rnd() - 0.5) * 1.2;
      if (!isPointInIndia(pLat, pLon)) continue;

      points.push({
        lat: Math.round(pLat * 1000) / 1000,
        lon: Math.round(pLon * 1000) / 1000,
        frp: Math.round(rnd() * 85 * 10) / 10,
        confidence: rnd() > 0.3 ? 'nominal' : 'high',
        acquired: 'Demonstration Indian Observation',
        satellite: 'VIIRS (Simulated)',
        daynight: rnd() > 0.5 ? 'D' : 'N',
      });
    }
  }

  if (bbox) {
    points = points.filter(
      (p) => p.lon >= bbox.minLon && p.lon <= bbox.maxLon && p.lat >= bbox.minLat && p.lat <= bbox.maxLat
    );
  }

  return {
    points,
    total: points.length,
    source: 'DEMO / SAMPLE Indian Telemetry (Configure FIRMS_MAP_KEY for live satellite detections)',
    live: false,
    isDemo: true,
    status: 'sample',
    fetchedAt: new Date().toISOString(),
    bbox: bbox ? [bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat] : [INDIA_BOUNDING_BOX.minLon, INDIA_BOUNDING_BOX.minLat, INDIA_BOUNDING_BOX.maxLon, INDIA_BOUNDING_BOX.maxLat],
  };
}

async function loadFires(options: FireQueryOptions): Promise<FireResult> {
  const parsedBbox = parseBoundingBox(options.bbox);
  if (!config.firmsKey) return sampleFires(parsedBbox);

  const rawSource = options.source || DEFAULT_SOURCE_KEY;
  const sourceKey = (rawSource in FIRMS_SOURCES ? rawSource : DEFAULT_SOURCE_KEY) as FirmsSourceKey;
  const sourceInfo = FIRMS_SOURCES[sourceKey];

  const maxDays = parsedBbox ? 10 : 5;
  const days = Math.min(Math.max(Math.round(options.days ?? 1), 1), maxDays);

  // Default to India's sovereign bounding box rather than global 'world'
  const areaStr = parsedBbox
    ? `${parsedBbox.minLon},${parsedBbox.minLat},${parsedBbox.maxLon},${parsedBbox.maxLat}`
    : INDIA_BBOX_STRING;

  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${config.firmsKey}/${sourceKey}/${areaStr}/${days}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`NASA FIRMS responded with HTTP ${res.status}`);
  const text = await res.text();
  if (text.startsWith('Invalid') || text.includes('<html')) {
    throw new Error('NASA FIRMS rejected the request (verify FIRMS_MAP_KEY or parameters)');
  }

  // Parse CSV and strictly retain detections inside India, dropping low confidence
  const all = parseCsv(text).filter((p) => !isLowConfidence(p.confidence));

  // Deduplicate points within ~1km with identical timestamp to avoid dual-satellite redundancy
  const seen = new Set<string>();
  const deduplicated: FirePoint[] = [];
  for (const p of all) {
    const key = `${p.lat.toFixed(2)}:${p.lon.toFixed(2)}:${p.acquired}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(p);
    }
  }

  const points = deduplicated.sort((a, b) => b.frp - a.frp).slice(0, MAX_POINTS);

  return {
    points,
    total: deduplicated.length,
    source: `${sourceInfo.name} · Republic of India`,
    live: true,
    isDemo: false,
    status: 'live',
    fetchedAt: new Date().toISOString(),
    bbox: parsedBbox
      ? [parsedBbox.minLon, parsedBbox.minLat, parsedBbox.maxLon, parsedBbox.maxLat]
      : [INDIA_BOUNDING_BOX.minLon, INDIA_BOUNDING_BOX.minLat, INDIA_BOUNDING_BOX.maxLon, INDIA_BOUNDING_BOX.maxLat],
  };
}

export function getFires(daysOrOptions: number | FireQueryOptions = 1): Promise<FireResult> {
  const options: FireQueryOptions =
    typeof daysOrOptions === 'number' ? { days: daysOrOptions } : daysOrOptions || { days: 1 };

  const parsedBbox = parseBoundingBox(options.bbox);
  const rawSource = options.source || DEFAULT_SOURCE_KEY;
  const sourceKey = rawSource in FIRMS_SOURCES ? rawSource : DEFAULT_SOURCE_KEY;
  const maxDays = parsedBbox ? 10 : 5;
  const days = Math.min(Math.max(Math.round(options.days ?? 1), 1), maxDays);
  const areaKey = parsedBbox
    ? `${parsedBbox.minLon.toFixed(2)},${parsedBbox.minLat.toFixed(2)},${parsedBbox.maxLon.toFixed(2)},${parsedBbox.maxLat.toFixed(2)}`
    : 'india';

  const cacheKey = `fires:${sourceKey}:${areaKey}:${days}`;
  return cached(cacheKey, 15 * 60 * 1000, () => loadFires(options));
}
