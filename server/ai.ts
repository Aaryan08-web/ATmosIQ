import { GoogleGenAI } from '@google/genai';
import { config } from './config.js';
import { getFires } from './data/fires.js';
import { getAirQuality } from './data/airQuality.js';
import { DEFORESTATION_HOTSPOTS } from './data/deforestation.js';
import { haversineKm } from './data/geo.js';

export interface AreaContext {
  name: string;
  lat: number;
  lon: number;
  radiusKm: number;
  fires: { count: number; totalFrp: number; maxFrp: number; live: boolean };
  /** 'unavailable' = the air-quality source failed; 'none-nearby' = source worked but no monitored city within 500 km. */
  airQualityStatus: 'ok' | 'unavailable' | 'none-nearby';
  airQuality: { station: string; distanceKm: number; usAqi: number | null; pm25: number | null; category: string } | null;
  deforestation: { name: string; distanceKm: number; driver: string; severity: string }[];
}

export async function buildContext(name: string, lat: number, lon: number, radiusKm = 150): Promise<AreaContext> {
  const [fires, aq] = await Promise.all([getFires(1), getAirQuality().catch(() => null)]);
  const aqAvailable = aq !== null;

  const near = fires.points.filter((p) => haversineKm(lat, lon, p.lat, p.lon) <= radiusKm);
  const totalFrp = near.reduce((s, p) => s + p.frp, 0);

  let station: AreaContext['airQuality'] = null;
  let best = Infinity;
  for (const s of aq?.points ?? []) {
    const d = haversineKm(lat, lon, s.lat, s.lon);
    if (d < best && d <= 500) {
      best = d;
      station = { station: s.name, distanceKm: Math.round(d), usAqi: s.usAqi, pm25: s.pm25, category: s.category };
    }
  }

  const defo = DEFORESTATION_HOTSPOTS
    .map((h) => ({ h, d: haversineKm(lat, lon, h.lat, h.lon) }))
    .filter((x) => x.d <= 800)
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map(({ h, d }) => ({ name: h.name, distanceKm: Math.round(d), driver: h.driver, severity: h.severity }));

  return {
    name, lat, lon, radiusKm,
    fires: {
      count: near.length,
      totalFrp: Math.round(totalFrp),
      maxFrp: Math.round(Math.max(0, ...near.map((p) => p.frp))),
      live: fires.live,
    },
    airQualityStatus: !aqAvailable ? 'unavailable' : station ? 'ok' : 'none-nearby',
    airQuality: station,
    deforestation: defo,
  };
}

/** Deterministic fallback so the feature still works without a Gemini key. */
export function ruleBasedSummary(c: AreaContext): string {
  const parts: string[] = [];
  parts.push(
    c.fires.count === 0
      ? `No high-confidence fire detections within ${c.radiusKm} km in the last 24 hours.`
      : `${c.fires.count} fire detections within ${c.radiusKm} km in the last 24 hours (combined radiative power ${c.fires.totalFrp} MW, strongest ${c.fires.maxFrp} MW).`
  );
  parts.push(
    c.airQuality
      ? `Nearest air-quality reading (${c.airQuality.station}, ${c.airQuality.distanceKm} km away): US AQI ${c.airQuality.usAqi ?? 'n/a'} — ${c.airQuality.category}.`
      : c.airQualityStatus === 'unavailable'
        ? 'Air-quality data is temporarily unavailable, so no air reading is included.'
        : 'No monitored city with an air-quality reading within 500 km.'
  );
  parts.push(
    c.deforestation.length
      ? `Nearby forest-loss pressure: ${c.deforestation.map((d) => `${d.name} (${d.distanceKm} km, ${d.driver})`).join('; ')}.`
      : 'No catalogued deforestation hotspot within 800 km.'
  );
  return parts.join(' ');
}

export async function summarise(c: AreaContext): Promise<{ text: string; source: 'gemini' | 'rule-based' }> {
  if (!config.geminiKey) return { text: ruleBasedSummary(c), source: 'rule-based' };

  const prompt = [
    'You are an environmental analyst writing a brief for a non-expert decision maker.',
    'Use ONLY the JSON data below. Do not invent numbers. If a field is missing or null, say the data is unavailable. If airQualityStatus is "unavailable" the air-quality source failed; if "none-nearby" there is no monitored city within 500 km.',
    'Write 3 short paragraphs: (1) current situation, (2) likely health or ecological impact, (3) two concrete recommended actions.',
    'Under 170 words total. Plain text, no markdown headings.',
    c.fires.live ? '' : 'Note: fire data is sample data, not live; say so.',
    '',
    JSON.stringify(c),
  ].join('\n');

  try {
    const ai = new GoogleGenAI({ apiKey: config.geminiKey });
    const resp = await ai.models.generateContent({ model: config.geminiModel, contents: prompt });
    const text = resp.text?.trim();
    if (!text) throw new Error('empty response');
    return { text, source: 'gemini' };
  } catch (err) {
    console.error('[ai] Gemini failed, using rule-based summary:', err instanceof Error ? err.message : err);
    return { text: ruleBasedSummary(c), source: 'rule-based' };
  }
}
