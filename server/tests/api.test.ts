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
    const n = new URL(url).searchParams.get('latitude')!.split(',').length;
    const body = Array.from({ length: n }, (_, i) => ({
      current: { time: '2026-01-01T00:00', us_aqi: i === 0 ? 160 : 40, pm2_5: 12, pm10: 20 },
    }));
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return realFetch(input, init);
}) as typeof fetch;

const { createApp } = await import('../app.js');
const { db } = await import('../db.js');
const { ruleBasedSummary } = await import('../ai.js');
const { aqiCategory } = await import('../data/airQuality.js');
const { haversineKm } = await import('../data/geo.js');

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
  assert.equal(aq.json.points.length, 45, 'README and landing page say 45 cities');
  assert.equal(aq.json.points[0].usAqi, 160);
  assert.equal(aq.json.points[0].category, 'Unhealthy');

  const ov = await call('GET', '/api/v1/overview', { cookie: userCookie });
  assert.equal(ov.json.airQuality.unhealthy, 1);
  assert.equal(ov.json.airQuality.worst.name, 'Delhi');
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
