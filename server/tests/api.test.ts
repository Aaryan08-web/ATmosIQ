import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

// Hermetic setup: temp database, no external keys, fake upstream network.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atmosiq-test-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
process.env.JWT_SECRET = 'test-secret';
process.env.COOKIE_SECURE = 'false';
process.env.FIRMS_MAP_KEY = '';
process.env.GEMINI_API_KEY = '';
process.env.ADMIN_EMAILS = 'boss@example.com';

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const url = String(input);
  if (url.includes('air-quality-api.open-meteo.com')) {
    const latParam = new URL(url).searchParams.get('latitude')!;
    const lats = latParam.split(',');
    if (lats.length === 1) {
      const body = {
        current: {
          time: '2026-01-01T00:00',
          us_aqi: 85,
          pm2_5: 28.4,
          pm10: 45.2,
          nitrogen_dioxide: 18.5,
          sulphur_dioxide: 4.2,
          carbon_monoxide: 320.0,
          ozone: 40.1,
        },
      };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    const n = lats.length;
    const body = Array.from({ length: n }, (_, i) => ({
      current: { time: '2026-01-01T00:00', us_aqi: i === 0 ? 160 : 40, pm2_5: 12, pm10: 20 },
    }));
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  }

  if (url.includes('data-api.globalforestwatch.org')) {
    const key = (init?.headers as Record<string, string>)?.[`x-api-key`];
    if (key === 'invalid-key') {
      return new Response(JSON.stringify({ errors: [{ detail: 'Unauthorized' }] }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }
    const body = {
      data: [
        {
          latitude: 11.45,
          longitude: 76.65,
          gfw_integrated_alerts__date: '2026-03-01',
          gfw_integrated_alerts__confidence: 'high',
          area__ha: 5.2,
        },
        {
          latitude: 21.95,
          longitude: 88.85,
          gfw_integrated_alerts__date: '2026-03-02',
          gfw_integrated_alerts__confidence: 'nominal',
          area__ha: 2.1,
        },
      ],
    };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  }

  return realFetch(input, init);
}) as typeof fetch;

const { createApp } = await import('../app.js');
const { db } = await import('../db.js');
const { config } = await import('../config.js');
const { ruleBasedSummary } = await import('../ai.js');
const { aqiCategory, getAirQualityPoint } = await import('../data/airQuality.js');
const { haversineKm } = await import('../data/geo.js');
const { parseBoundingBox, FIRMS_SOURCES, getFires, httpsGetIpv4 } = await import('../data/fires.js');
const { syncGfwAlerts, getGfwSyncStatus, getGfwForestAlerts } = await import('../data/gfwIngestion.js');

let server: Server;
let base = '';

before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function call(method: string, url: string, opts: { body?: unknown; cookie?: string; ip?: string } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: {
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
      ...(opts.ip ? { 'x-forwarded-for': opts.ip } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const cookie = res.headers.get('set-cookie')?.split(';')[0];
  const json = await res.json().catch(() => null);
  return { status: res.status, json, cookie };
}

const PW = 'Passw0rd!x';
let userCookie = '';

test('health endpoint reports integrations', async () => {
  const r = await call('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.deepEqual(r.json.integrations, { firms: false, gemini: false });
});

test('HSTS header is only sent when serving HTTPS (COOKIE_SECURE=true)', async () => {
  const res = await fetch(base + '/api/health');
  assert.equal(res.headers.get('strict-transport-security'), null);
  assert.ok(res.headers.get('content-security-policy'), 'CSP stays on');
});

test('data routes require a session', async () => {
  for (const p of ['/api/v1/fires', '/api/v1/air-quality', '/api/v1/deforestation', '/api/v1/overview']) {
    assert.equal((await call('GET', p)).status, 401, p);
  }
});

test('signup validates input and rejects duplicates', async () => {
  assert.equal((await call('POST', '/api/v1/auth/signup', { body: { name: 'A', email: 'bad', password: PW } })).status, 400);
  assert.equal((await call('POST', '/api/v1/auth/signup', { body: { name: 'A', email: 'a@b.co', password: '123' } })).status, 400);
  const ok = await call('POST', '/api/v1/auth/signup', { body: { name: 'Test User', email: 'Test@Example.com', password: PW } });
  assert.equal(ok.status, 201);
  assert.equal(ok.json.user.email, 'test@example.com');
  assert.equal(ok.json.user.role, 'analyst');
  assert.ok(ok.cookie?.startsWith('atmq_session='));
  userCookie = ok.cookie!;
  const dup = await call('POST', '/api/v1/auth/signup', { body: { name: 'T', email: 'test@example.com', password: PW } });
  assert.equal(dup.status, 409);
});

test('login, session and logout', async () => {
  assert.equal((await call('POST', '/api/v1/auth/login', { body: { email: 'test@example.com', password: 'wrong-password' } })).status, 401);
  const ok = await call('POST', '/api/v1/auth/login', { body: { email: 'test@example.com', password: PW } });
  assert.equal(ok.status, 200);
  const me = await call('GET', '/api/v1/auth/me', { cookie: ok.cookie });
  assert.equal(me.status, 200);
  assert.equal(me.json.user.name, 'Test User');
  assert.equal(JSON.stringify(me.json).includes('password'), false, 'must never leak the hash');
  assert.equal((await call('POST', '/api/v1/auth/logout')).status, 200);
});

test('lockout is per device: attacker locked out, real owner unaffected', async () => {
  await call('POST', '/api/v1/auth/signup', { body: { name: 'Victim', email: 'victim@example.com', password: PW } });
  const attacker = '203.0.113.9';
  const codes: number[] = [];
  for (let i = 0; i < 6; i++) {
    codes.push((await call('POST', '/api/v1/auth/login', { body: { email: 'victim@example.com', password: `bad-guess-${i}` }, ip: attacker })).status);
  }
  assert.deepEqual(codes, [401, 401, 401, 401, 401, 429]);
  // Even the right password is refused for the locked device...
  assert.equal((await call('POST', '/api/v1/auth/login', { body: { email: 'victim@example.com', password: PW }, ip: attacker })).status, 429);
  // ...but the real owner on another device can still sign in.
  assert.equal((await call('POST', '/api/v1/auth/login', { body: { email: 'victim@example.com', password: PW }, ip: '198.51.100.7' })).status, 200);
});

test('remember-me controls cookie persistence', async () => {
  const remembered = await fetch(base + '/api/v1/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: PW, rememberMe: true }),
  });
  assert.match(remembered.headers.get('set-cookie') ?? '', /Max-Age=\d+/i);
  const session = await fetch(base + '/api/v1/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: PW, rememberMe: false }),
  });
  assert.equal(session.status, 200);
  assert.doesNotMatch(session.headers.get('set-cookie') ?? '', /Max-Age|Expires/i, 'session cookie must not persist');
});

test('role-based access: admin route', async () => {
  assert.equal((await call('GET', '/api/v1/admin/users')).status, 401);
  assert.equal((await call('GET', '/api/v1/admin/users', { cookie: userCookie })).status, 403);
  const boss = await call('POST', '/api/v1/auth/signup', { body: { name: 'Boss', email: 'boss@example.com', password: PW } });
  assert.equal(boss.json.user.role, 'admin');
  const list = await call('GET', '/api/v1/admin/users', { cookie: boss.cookie });
  assert.equal(list.status, 200);
  assert.ok(list.json.users.length >= 3);
  assert.equal(JSON.stringify(list.json).includes('password_hash'), false);
});

test('data endpoints return labelled data', async () => {
  const fires = await call('GET', '/api/v1/fires', { cookie: userCookie });
  assert.equal(fires.status, 200);
  assert.equal(fires.json.live, false, 'sample data must be flagged as not live');
  assert.ok(fires.json.points.length > 0);

  const defo = await call('GET', '/api/v1/deforestation', { cookie: userCookie });
  assert.equal(defo.json.live, false);
  assert.equal(defo.json.points.length, 12);

  const aq = await call('GET', '/api/v1/air-quality', { cookie: userCookie });
  assert.equal(aq.status, 200);
  assert.equal(aq.json.points.length, 58, 'Indian cities covering all 28 states and 8 UTs');
  assert.equal(aq.json.points[0].usAqi, 160);
  assert.equal(aq.json.points[0].category, 'Unhealthy');

  const ov = await call('GET', '/api/v1/overview', { cookie: userCookie });
  assert.equal(ov.json.airQuality.unhealthy, 1);
  assert.equal(ov.json.airQuality.worst.name, 'Delhi NCR');
});

test('AI summary validates input and falls back to the rule-based brief', async () => {
  const bad = await call('POST', '/api/v1/ai/summary', { body: { name: 'x', lat: 999, lon: 0 }, cookie: userCookie });
  assert.equal(bad.status, 400);
  const ok = await call('POST', '/api/v1/ai/summary', { body: { name: 'Delhi, India', lat: 28.61, lon: 77.21 }, cookie: userCookie });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.source, 'rule-based');
  assert.match(ok.json.summary, /AQI 160/);
});

test('rule-based brief tells "source failed" apart from "nothing nearby"', () => {
  const base = {
    name: 'X', lat: 0, lon: 0, radiusKm: 150,
    fires: { count: 0, totalFrp: 0, maxFrp: 0, live: true },
    airQuality: null, deforestation: [],
  };
  const failed = ruleBasedSummary({ ...base, airQualityStatus: 'unavailable' });
  assert.match(failed, /temporarily unavailable/);
  assert.doesNotMatch(failed, /within 500 km/);
  const none = ruleBasedSummary({ ...base, airQualityStatus: 'none-nearby' });
  assert.match(none, /within 500 km/);
  assert.doesNotMatch(none, /unavailable/);
});

test('unknown API routes return JSON 404', async () => {
  const r = await call('GET', '/api/nope');
  assert.equal(r.status, 404);
  assert.equal(r.json.error, 'Not found');
});

test('aqiCategory follows the US AQI bands', () => {
  assert.equal(aqiCategory(null), 'Unknown');
  assert.equal(aqiCategory(50), 'Good');
  assert.equal(aqiCategory(51), 'Moderate');
  assert.equal(aqiCategory(150), 'Unhealthy for sensitive groups');
  assert.equal(aqiCategory(151), 'Unhealthy');
  assert.equal(aqiCategory(250), 'Very unhealthy');
  assert.equal(aqiCategory(301), 'Hazardous');
});

test('haversineKm is accurate', () => {
  assert.equal(Math.round(haversineKm(0, 0, 0, 0)), 0);
  const puneMumbai = haversineKm(18.52, 73.86, 19.08, 72.88);
  assert.ok(puneMumbai > 110 && puneMumbai < 125, String(puneMumbai));
});

test('parseBoundingBox validates coordinates strictly', () => {
  assert.equal(parseBoundingBox(undefined), null);
  const parsed = parseBoundingBox('68.0,8.0,97.5,37.0');
  assert.deepEqual(parsed, { minLon: 68.0, minLat: 8.0, maxLon: 97.5, maxLat: 37.0 });

  assert.throws(() => parseBoundingBox('bad,coords'), /Invalid bounding box format/);
  assert.throws(() => parseBoundingBox('-190,0,10,10'), /out of bounds/);
  assert.throws(() => parseBoundingBox('50,0,20,10'), /minLon cannot be greater than maxLon/);
  assert.throws(() => parseBoundingBox('0,50,10,20'), /minLat cannot be greater than maxLat/);
});

test('FIRMS queries support satellite sources and bounding boxes', async () => {
  assert.ok('VIIRS_SNPP_NRT' in FIRMS_SOURCES);
  assert.ok('VIIRS_NOAA20_NRT' in FIRMS_SOURCES);
  assert.ok('VIIRS_NOAA21_NRT' in FIRMS_SOURCES);
  assert.ok('MODIS_NRT' in FIRMS_SOURCES);

  // Regional sample query returns filtered bounding box results
  const res = await call('GET', '/api/v1/fires?bbox=68,8,97,37&days=2&source=VIIRS_NOAA20_NRT', { cookie: userCookie });
  assert.equal(res.status, 200);
  assert.equal(res.json.live, false);
  assert.ok(Array.isArray(res.json.points));
});

test('httpsGetIpv4 helper enforces family: 4 and handles requests', async () => {
  assert.equal(typeof httpsGetIpv4, 'function');
  await assert.rejects(
    () => httpsGetIpv4('https://non-existent-domain-atmosiq-test.invalid', 100),
    /timed out|ENOTFOUND|EAI_AGAIN|getaddrinfo/
  );
});

test('Open-Meteo coordinate-based lookup returns multi-pollutant measurements', async () => {
  const bad = await call('GET', '/api/v1/air-quality/point?lat=999&lon=0', { cookie: userCookie });
  assert.equal(bad.status, 400);

  const res = await call('GET', '/api/v1/air-quality/point?lat=28.61&lon=77.21&name=Delhi+Node', { cookie: userCookie });
  assert.equal(res.status, 200);
  assert.equal(res.json.live, true);
  assert.equal(res.json.point.name, 'Delhi Node');
  assert.equal(res.json.point.usAqi, 85);
  assert.equal(res.json.point.pm25, 28.4);
  assert.equal(res.json.point.pm10, 45.2);
  assert.equal(res.json.point.no2, 18.5);
  assert.equal(res.json.point.so2, 4.2);
  assert.equal(res.json.point.co, 320.0);
  assert.equal(res.json.point.o3, 40.1);
  assert.ok(res.json.metadata);
  assert.match(res.json.metadata.provider, /Copernicus/);
});

test('coordinate lookup rejects invalid coordinates with 400', async () => {
  const nanLat = await call('GET', '/api/v1/air-quality/point?lat=abc&lon=77.21', { cookie: userCookie });
  assert.equal(nanLat.status, 400);

  const outOfRange = await call('GET', '/api/v1/air-quality/point?lat=28.61&lon=999', { cookie: userCookie });
  assert.equal(outOfRange.status, 400);

  const outOfIndia = await call('GET', '/api/v1/air-quality/point?lat=51.5&lon=-0.1', { cookie: userCookie });
  assert.equal(outOfIndia.status, 400);

  const missing = await call('GET', '/api/v1/air-quality/point', { cookie: userCookie });
  assert.equal(missing.status, 400);
});

test('GFW sync tracks unauthorized when key is rejected', async () => {
  config.gfwKey = 'invalid-key';
  const syncRes = await syncGfwAlerts(true);
  assert.equal(syncRes.status, 'unauthorized');
  assert.match(syncRes.error_message || '', /authorization rejected/);

  const statusDb = getGfwSyncStatus();
  assert.equal(statusDb.status, 'unauthorized');
});

test('GFW sync normalizes alert records and stores in SQLite', async () => {
  config.gfwKey = 'valid-test-key';
  const syncRes = await syncGfwAlerts(true);
  assert.equal(syncRes.status, 'success');
  assert.ok(syncRes.records_ingested >= 2);

  const alerts = getGfwForestAlerts(10);
  assert.ok(alerts.length >= 2);
  const top = alerts[0];
  assert.ok(top.alert_id);
  assert.equal(typeof top.latitude, 'number');
  assert.equal(typeof top.longitude, 'number');
  assert.ok(['high', 'nominal', 'low'].includes(top.confidence));
  assert.equal(top.dataset, 'gfw_integrated_alerts');
});

test('GFW alert deduplication prevents redundant records on re-sync', async () => {
  config.gfwKey = 'valid-test-key';
  const beforeCount = getGfwForestAlerts(100).length;
  await syncGfwAlerts(true);
  const afterCount = getGfwForestAlerts(100).length;
  assert.equal(afterCount, beforeCount, 'Alert records must be deduplicated by alert_id');
});

test('historical environmental intelligence retrieval via /history', async () => {
  // Insert a test snapshot into SQLite
  const now = Date.now();
  db.prepare(`
    INSERT INTO environmental_snapshots (id, timestamp, fire_count, unhealthy_aqi_count, worst_aqi, worst_city, total_frp, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('test-snap-1', new Date(now).toISOString(), 12, 3, 175, 'Delhi', 450, now);

  const res = await call('GET', '/api/v1/history?limit=10', { cookie: userCookie });
  assert.equal(res.status, 200);
  assert.ok(res.json.count >= 1);
  assert.ok(Array.isArray(res.json.snapshots));
  const snap = res.json.snapshots.find((s: { id: string }) => s.id === 'test-snap-1');
  assert.ok(snap);
  assert.equal(snap.fire_count, 12);
  assert.equal(snap.worst_aqi, 175);
  assert.equal(snap.total_frp, 450);

  // Time filter test
  const future = await call('GET', `/api/v1/history?since=${now + 100000}`, { cookie: userCookie });
  assert.equal(future.status, 200);
  assert.equal(future.json.count, 0);
});

test('alerts endpoint unifies observations across FIRMS, CAMS and GFW', async () => {
  const res = await call('GET', '/api/v1/alerts', { cookie: userCookie });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.json.alerts));
  assert.ok(res.json.total >= 1);

  // Acknowledgment toggle test
  const alertId = res.json.alerts[0].id;
  const ack = await call('POST', `/api/v1/alerts/${alertId}/acknowledge`, { cookie: userCookie });
  assert.equal(ack.status, 200);
  assert.equal(ack.json.ok, true);
  assert.equal(ack.json.acknowledged, 1);
});
