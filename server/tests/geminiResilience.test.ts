import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  callGeminiWithRetry,
  summarise,
  buildContext,
  ruleBasedSummary,
  parseGeminiError,
  calculateBackoff,
  sanitizeErrorDetails,
  logConciseError,
  resetLoggingDeduplicationForTests,
  buildAiSummaryCacheKey,
  getCachedAiSummary,
  setCachedAiSummary,
  clearAiSummaryCache,
  type AreaContext,
  type BuildContextProviders,
  type GeminiDiagnosticLog,
} from '../ai.js';
import type { AiSummary } from '../../src/types.js';
import type { AqResult } from '../data/airQuality.js';
import type { FireResult } from '../data/fires.js';

// ---------------------------------------------------------------------------
// Shared deterministic providers — used in tests that call buildContext so
// they never make live network requests (keeps tests fast and reproducible).
// ---------------------------------------------------------------------------
const MOCK_AQ_RESULT: AqResult = {
  points: [
    { name: 'Delhi NCR', state: 'Delhi', country: 'India', lat: 28.6139, lon: 77.2090, usAqi: 175, pm25: 88.5, pm10: 120.0, no2: 45.0, so2: 12.0, co: 500.0, o3: 30.0, category: 'Unhealthy', time: '2026-01-01T00:00' },
    { name: 'Pune',      state: 'Maharashtra', country: 'India', lat: 18.5204, lon: 73.8567, usAqi: 94,  pm25: 32.0, pm10: 55.0,  no2: 20.0, so2: 5.0,  co: 200.0, o3: 40.0, category: 'Moderate',  time: '2026-01-01T00:00' },
    { name: 'Kolkata',   state: 'West Bengal',  country: 'India', lat: 22.5726, lon: 88.3639, usAqi: 120, pm25: 45.0, pm10: 70.0,  no2: 25.0, so2: 8.0,  co: 300.0, o3: 35.0, category: 'Unhealthy for sensitive groups', time: '2026-01-01T00:00' },
  ],
  source: 'mock-fixture',
  live: false,
  fetchedAt: new Date().toISOString(),
};

const MOCK_FIRE_RESULT: FireResult = {
  points: [
    // Near Delhi (within 150 km)
    { lat: 28.9, lon: 77.1, frp: 42.0, confidence: 'nominal', acquired: '2026-01-01 06:00 UTC', satellite: 'VIIRS (mock)', daynight: 'D' },
    { lat: 29.1, lon: 77.4, frp: 85.0, confidence: 'high',    acquired: '2026-01-01 06:00 UTC', satellite: 'VIIRS (mock)', daynight: 'D' },
    { lat: 28.5, lon: 76.9, frp: 30.0, confidence: 'nominal', acquired: '2026-01-01 06:00 UTC', satellite: 'VIIRS (mock)', daynight: 'N' },
    // Well outside Pune and Sundarbans 150 km radius
    { lat: 15.0, lon: 74.0, frp: 15.0, confidence: 'nominal', acquired: '2026-01-01 06:00 UTC', satellite: 'VIIRS (mock)', daynight: 'D' },
  ],
  total: 4,
  source: 'mock-fixture',
  live: false,
  isDemo: true,
  status: 'sample',
  fetchedAt: new Date().toISOString(),
  bbox: [68.0, 6.5, 97.5, 37.5],
};

const MOCK_PROVIDERS: BuildContextProviders = {
  getFiresData: async () => MOCK_FIRE_RESULT,
  getAirQualityData: async () => MOCK_AQ_RESULT,
};

// Dynamically import frontend page component for server-side HTML rendering tests
// @ts-ignore - TS resolution handled via bundler paths in root tsconfig
const { AiBriefPage } = (await import('../../src/pages/dashboard/AiBriefPage.js' as any)) as {
  AiBriefPage: React.ComponentType<{ initialSummary?: AiSummary | null }>;
};

const mockContext: AreaContext = {
  name: 'Delhi NCR Central Observatory',
  lat: 28.6139,
  lon: 77.2090,
  radiusKm: 150,
  fires: { count: 8, totalFrp: 340, maxFrp: 85, live: true },
  airQualityStatus: 'ok',
  airQuality: {
    station: 'Delhi NCR Central',
    distanceKm: 0,
    usAqi: 175,
    pm25: 88.5,
    category: 'Unhealthy',
  },
  deforestation: [
    { name: 'Western Ghats Front', distanceKm: 450, driver: 'Commodity agriculture', severity: 'Critical' },
  ],
};

function createMock503Error(message = 'The model is overloaded. Please try again later.', retryAfter?: string | number) {
  const err = new Error(message);
  (err as unknown as { status: number }).status = 503;
  if (retryAfter !== undefined) {
    (err as unknown as { response: { headers: { get: (k: string) => string } } }).response = {
      headers: {
        get: (k: string) => (k.toLowerCase() === 'retry-after' ? String(retryAfter) : ''),
      },
    };
  }
  return err;
}

beforeEach(() => {
  resetLoggingDeduplicationForTests();
  clearAiSummaryCache();
});

// Test 1: Gemini success
test('Gemini success: single call succeeds with generated text and no fallback', async () => {
  let callCount = 0;
  const runner = async () => {
    callCount++;
    return { text: 'ATmosIQ environmental intelligence: Active thermal clustering observed in Delhi perimeter.' };
  };

  const res = await callGeminiWithRetry('Generate brief for Delhi', {
    apiKey: 'test-valid-key',
    runner,
    maxAttempts: 3,
  });

  assert.equal(callCount, 1);
  assert.equal(res.attempts, 1);
  assert.match(res.text, /Active thermal clustering observed/);

  // Test integrated summarise
  const summaryRes = await summarise(mockContext, {
    apiKey: 'test-valid-key',
    runner,
  });

  assert.equal(summaryRes.source, 'gemini');
  assert.equal(summaryRes.fallback, undefined);
  assert.match(summaryRes.text, /Active thermal clustering observed/);
  assert.ok(summaryRes.timing);
  assert.equal(typeof summaryRes.timing.geminiMs, 'number');
});

// Test 2: One temporary 503 followed by success
test('One temporary 503 followed by success: retried with backoff and succeeds on attempt 2', async () => {
  let callCount = 0;
  const delays: number[] = [];

  const runner = async () => {
    callCount++;
    if (callCount === 1) {
      throw createMock503Error('503 Service Unavailable: High server load');
    }
    return { text: 'Delhi air quality remains elevated with high particulate density.' };
  };

  const res = await callGeminiWithRetry('Generate brief', {
    apiKey: 'test-valid-key',
    runner,
    maxAttempts: 3,
    baseDelayMs: 10,
    jitter: false,
    sleep: async (ms) => {
      delays.push(ms);
    },
  });

  assert.equal(callCount, 2);
  assert.equal(res.attempts, 2);
  assert.equal(delays.length, 1);
  assert.equal(delays[0], 10, 'First retry used base delay 10ms');
  assert.match(res.text, /Delhi air quality remains elevated/);

  // Integrated summarise test
  let summariseCalls = 0;
  const summaryRes = await summarise(mockContext, {
    apiKey: 'test-valid-key',
    runner: async () => {
      summariseCalls++;
      if (summariseCalls === 1) throw createMock503Error('503 overloaded');
      return { text: 'Summary recovered after 503.' };
    },
    baseDelayMs: 1,
    jitter: false,
    sleep: async () => {},
  });

  assert.equal(summariseCalls, 2);
  assert.equal(summaryRes.source, 'gemini');
  assert.equal(summaryRes.fallback, undefined);
  assert.equal(summaryRes.text, 'Summary recovered after 503.');
});

// Test 3: Three consecutive 503 failures followed by rule-based fallback
test('Three consecutive 503 failures followed by rule-based fallback: exactly 3 attempts and one concise error', async () => {
  let callCount = 0;
  const loggedErrors: string[] = [];

  const runner = async () => {
    callCount++;
    throw createMock503Error(`503 Server Overloaded (attempt ${callCount})`);
  };

  const summaryRes = await summarise(mockContext, {
    apiKey: 'test-valid-key',
    runner,
    maxAttempts: 3,
    baseDelayMs: 1,
    jitter: false,
    sleep: async () => {},
    logger: (msg) => loggedErrors.push(msg),
  });

  assert.equal(callCount, 3, 'Must stop at exactly 3 attempts');
  assert.equal(summaryRes.source, 'rule-based');
  assert.equal(summaryRes.fallback, true);
  assert.equal(summaryRes.fallbackReason, 'service_unavailable');

  // Verify that rule-based brief grounded in real context is returned (never invented)
  assert.match(summaryRes.text, /8 fire detections within 150 km/);
  assert.match(summaryRes.text, /US AQI 175 — Unhealthy/);
  assert.match(summaryRes.text, /Western Ghats Front/);

  // Verify only one concise error is logged after all retries are exhausted
  assert.equal(loggedErrors.length, 1, 'Only one error logged after exhausting retries');
  assert.match(loggedErrors[0], /\[ai\] Provider: gemini \| Status: 503/);
});

// Test 4: Invalid API key without retries
test('Invalid API key without retries: fails immediately on attempt 1 without retry loops', async () => {
  let callCount = 0;
  const loggedErrors: string[] = [];
  const sensitiveKey = 'AIzaSySecretApiKey1234567890';

  const runner = async () => {
    callCount++;
    const err = new Error(`[GoogleGenerativeAI Error]: API key not valid. Please pass a valid API key. (key=${sensitiveKey})`);
    (err as unknown as { status: number }).status = 400;
    throw err;
  };

  const summaryRes = await summarise(mockContext, {
    apiKey: sensitiveKey,
    runner,
    maxAttempts: 3,
    baseDelayMs: 1,
    logger: (msg) => loggedErrors.push(msg),
  });

  assert.equal(callCount, 1, 'Must NOT retry invalid API keys');
  assert.equal(summaryRes.source, 'rule-based');
  assert.equal(summaryRes.fallback, true);

  // Verify error details are sanitized and do not leak the API key
  assert.equal(loggedErrors.length, 1);
  assert.doesNotMatch(loggedErrors[0], new RegExp(sensitiveKey), 'Secret key must be redacted');
  assert.match(loggedErrors[0], /\[REDACTED\]/);
});

// Test 5: Gemini timeout
test('Gemini timeout: handles request timeout and falls back to rule-based summary', async () => {
  let callCount = 0;
  const loggedErrors: string[] = [];

  const hangingRunner = async () => {
    callCount++;
    // Returns a promise that never resolves within timeoutMs
    return new Promise<{ text: string }>(() => {});
  };

  const summaryRes = await summarise(mockContext, {
    apiKey: 'test-valid-key',
    runner: hangingRunner,
    maxAttempts: 2,
    timeoutMs: 20, // 20ms timeout
    baseDelayMs: 1,
    jitter: false,
    sleep: async () => {},
    logger: (msg) => loggedErrors.push(msg),
  });

  assert.equal(callCount, 2, 'Timed out attempts were executed up to maxAttempts');
  assert.equal(summaryRes.source, 'rule-based');
  assert.equal(summaryRes.fallback, true);
  assert.equal(summaryRes.fallbackReason, 'timeout');
  assert.match(summaryRes.text, /8 fire detections within 150 km/);

  assert.equal(loggedErrors.length, 1);
  assert.match(loggedErrors[0], /timed out/i);
});

// Test 6: Fallback response rendered successfully in the frontend
test('Fallback response rendered successfully in the frontend', () => {
  const fallbackSummary: AiSummary = {
    summary:
      '8 fire detections within 150 km in the last 24 hours (combined radiative power 340 MW, strongest 85 MW).\nNearest air-quality reading (Delhi NCR Central, 0 km away): US AQI 175 — Unhealthy.\nNearby forest-loss pressure: Western Ghats Front (450 km, Commodity agriculture).',
    source: 'rule-based',
    fallback: true,
    fallbackReason: 'service_unavailable',
    generatedAt: new Date().toISOString(),
    context: {
      fires: { count: 8, totalFrp: 340, maxFrp: 85, live: true },
      radiusKm: 150,
    },
  };

  const html = renderToString(React.createElement(AiBriefPage, { initialSummary: fallbackSummary }));

  // 1. Shows the small, unobtrusive fallback notice
  assert.ok(
    html.includes('AI service temporarily unavailable. Showing an environmental analysis based on available data.'),
    'Must display exact unobtrusive fallback message'
  );

  // 2. Provides the retry action
  assert.ok(html.includes('Retry AI Brief'), 'Must provide a retry action for temporary fallback');

  // 3. Renders the fallback badge clearly
  assert.ok(html.includes('Rule-Based Analytical Brief (Fallback)'), 'Must indicate fallback system');

  // 4. Renders the actual environmental brief content
  assert.ok(html.includes('8 fire detections within 150 km'), 'Must display real situation data');
  assert.ok(html.includes('US AQI 175'), 'Must display real AQI');

  // 5. Must NOT display generic "Could not build summary" or generic failure message when fallback succeeds
  assert.ok(!html.includes('Could not build summary'), 'Must not show generic failure message');
  assert.ok(!html.includes('Could not generate environmental brief'), 'Must not show error banner on successful fallback');

  // Compare with Gemini success rendering
  const geminiSummary: AiSummary = {
    summary: 'Direct Gemini synthesized intelligence analysis.',
    source: 'gemini',
    fallback: false,
    generatedAt: new Date().toISOString(),
    context: {
      fires: { count: 8, totalFrp: 340, maxFrp: 85, live: true },
      radiusKm: 150,
    },
  };

  const successHtml = renderToString(React.createElement(AiBriefPage, { initialSummary: geminiSummary }));
  assert.ok(successHtml.includes('Google Gemini Intelligence'));
  assert.ok(!successHtml.includes('AI service temporarily unavailable'));
  assert.ok(!successHtml.includes('Retry AI Brief'));
});

// Test 7: Location Differentiation for Delhi, Pune, and Sundarbans
test('Location Differentiation: Delhi, Pune and Sundarbans use actual coordinates and generate distinct summaries', async () => {
  // Delhi coordinates: 28.6139°N, 77.2090°E
  const delhiCtx = await buildContext('Delhi NCR', 28.6139, 77.209, 150, MOCK_PROVIDERS);
  assert.equal(delhiCtx.lat, 28.6139);
  assert.equal(delhiCtx.lon, 77.209);
  assert.equal(delhiCtx.airQuality?.station, 'Delhi NCR');
  assert.equal(delhiCtx.airQuality?.usAqi, 175);
  assert.equal(delhiCtx.airQuality?.category, 'Unhealthy');

  // Pune coordinates: 18.5204°N, 73.8567°E
  const puneCtx = await buildContext('Pune & Western Ghats', 18.5204, 73.8567, 150, MOCK_PROVIDERS);
  assert.equal(puneCtx.lat, 18.5204);
  assert.equal(puneCtx.lon, 73.8567);
  assert.equal(puneCtx.airQuality?.station, 'Pune');
  assert.equal(puneCtx.airQuality?.usAqi, 94);
  assert.equal(puneCtx.airQuality?.category, 'Moderate');

  // Sundarbans coordinates: 21.9500°N, 88.8500°E
  const sundarCtx = await buildContext('Sundarbans Delta', 21.95, 88.85, 150, MOCK_PROVIDERS);
  assert.equal(sundarCtx.lat, 21.95);
  assert.equal(sundarCtx.lon, 88.85);
  assert.equal(sundarCtx.airQuality?.station, 'Kolkata');
  assert.equal(sundarCtx.fires.count, 0, 'Sundarbans delta perimeter has 0 fires in sample pass');

  // Fallback summaries reflect actual differences without hardcoding
  const delhiSummary = ruleBasedSummary(delhiCtx);
  const puneSummary = ruleBasedSummary(puneCtx);
  const sundarSummary = ruleBasedSummary(sundarCtx);

  assert.match(delhiSummary, /US AQI 175 — Unhealthy/);
  assert.match(delhiSummary, /Rajaji-Corbett Shivalik/);

  assert.match(puneSummary, /US AQI 94 — Moderate/);
  assert.match(puneSummary, /Koyna-Mahabaleshwar/);

  assert.match(sundarSummary, /No high-confidence fire detections within 150 km/);
  assert.match(sundarSummary, /Sundarbans Biosphere Reserve/);

  // Verify all 3 are distinct
  assert.notEqual(delhiSummary, puneSummary);
  assert.notEqual(puneSummary, sundarSummary);
  assert.notEqual(delhiSummary, sundarSummary);

  // Verify prompt passed to Gemini receives exact selected coordinates and telemetry
  let capturedPrompt = '';
  await summarise(delhiCtx, {
    apiKey: 'test-key',
    runner: async ({ contents }) => {
      capturedPrompt = contents;
      return { text: 'Simulated output' };
    },
  });
  assert.match(capturedPrompt, /28\.6139/);
  assert.match(capturedPrompt, /Delhi NCR/);
  assert.match(capturedPrompt, /175/);
});

// Test 8: Caching key distinguishes lat/lon, radius, freshness, and brief type
test('Caching: cache key strictly distinguishes coordinates, radius, freshness, and brief type', () => {
  const k1 = buildAiSummaryCacheKey({ lat: 28.6139, lon: 77.209, radiusKm: 150, dataFreshness: 100, briefType: 'standard' });
  const k2 = buildAiSummaryCacheKey({ lat: 18.5204, lon: 73.8567, radiusKm: 150, dataFreshness: 100, briefType: 'standard' });
  const kRadius = buildAiSummaryCacheKey({ lat: 28.6139, lon: 77.209, radiusKm: 250, dataFreshness: 100, briefType: 'standard' });
  const kFreshness = buildAiSummaryCacheKey({ lat: 28.6139, lon: 77.209, radiusKm: 150, dataFreshness: 101, briefType: 'standard' });
  const kType = buildAiSummaryCacheKey({ lat: 28.6139, lon: 77.209, radiusKm: 150, dataFreshness: 100, briefType: 'detailed' });

  // All 5 variants must produce completely unique cache keys
  assert.notEqual(k1, k2, 'Latitude and longitude differentiation');
  assert.notEqual(k1, kRadius, 'Radius differentiation');
  assert.notEqual(k1, kFreshness, 'Data freshness differentiation');
  assert.notEqual(k1, kType, 'Brief type differentiation');
});

// Test 9: Cache isolation and coordinate changes
test('Caching: coordinate changes isolate cache entries and prevent stale reuse', () => {
  const delhiKey = buildAiSummaryCacheKey({ lat: 28.6139, lon: 77.209, radiusKm: 150 });
  const puneKey = buildAiSummaryCacheKey({ lat: 18.5204, lon: 73.8567, radiusKm: 150 });

  const delhiPayload = {
    summary: 'Delhi specific environmental brief',
    source: 'rule-based' as const,
    fallback: true,
    context: mockContext,
    generatedAt: new Date().toISOString(),
    cacheKey: delhiKey,
    timing: { dataRetrievalMs: 50, geminiMs: 0, backoffMs: 0, fallbackMs: 1, totalMs: 51, cached: false },
  };

  setCachedAiSummary(delhiKey, delhiPayload);

  // Querying Pune must miss cache completely (no cross-contamination)
  assert.equal(getCachedAiSummary(puneKey), null, 'Pune must miss Delhi cache');

  // Querying Delhi must hit cache in < 1ms (< 1 second target)
  const t0 = performance.now();
  const hit = getCachedAiSummary(delhiKey);
  const dur = performance.now() - t0;
  assert.ok(hit !== null);
  assert.equal(hit?.summary, 'Delhi specific environmental brief');
  assert.ok(dur < 1000, `Cached response duration was ${dur}ms, well under 1000ms`);
});

// Test 10: Performance latency measurement
test('Latency targets: rule-based fallback executes in under 2 seconds and cached response in under 1 second', async () => {
  // 1. Measure rule-based fallback latency
  const tStart = performance.now();
  const ctx = await buildContext('Delhi NCR', 28.6139, 77.209, 150, MOCK_PROVIDERS);
  const out = await summarise(ctx, { apiKey: '' }); // explicitly benchmark pure rule-based fallback without external network
  const totalMs = performance.now() - tStart;

  assert.equal(out.source, 'rule-based');
  assert.ok(totalMs < 2000, `Rule-based fallback took ${totalMs}ms, must be < 2000ms`);
  assert.ok(out.timing);
  assert.ok(out.timing.fallbackMs < 50);

  // 2. Measure failure latency bound (worst-case failure must not take ~1 minute)
  const tFailStart = performance.now();
  await summarise(ctx, {
    apiKey: 'test-key',
    runner: async () => {
      throw createMock503Error('503 Service Unavailable');
    },
    maxAttempts: 3,
    baseDelayMs: 2,
    jitter: false,
    sleep: async () => {},
  });
  const failDuration = performance.now() - tFailStart;
  assert.ok(failDuration < 5000, `Gemini failure completed in ${failDuration}ms, far below 60s`);
});

// Test 11: SDK timeout cancellation aborts underlying HTTP request
test('SDK timeout cancellation actually aborts underlying HTTP request', async () => {
  let serverSawAbort = false;
  let serverSawClose = false;

  const localServer = http
    .createServer((req, res) => {
      req.on('aborted', () => {
        serverSawAbort = true;
      });
      req.on('close', () => {
        serverSawClose = true;
      });
      res.on('close', () => {
        serverSawClose = true;
      });
      req.socket.on('close', () => {
        serverSawClose = true;
      });
      // Hang indefinitely without writing response
    })
    .listen(0, '127.0.0.1');

  await new Promise((resolve) => localServer.once('listening', resolve));
  const port = (localServer.address() as { port: number }).port;

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({
    apiKey: 'test-dummy-key',
    httpOptions: { baseUrl: `http://127.0.0.1:${port}`, timeout: 60 },
  });

  try {
    await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: 'Test timeout abort' });
    assert.fail('Should have timed out');
  } catch (err: unknown) {
    assert.ok(
      (err as Error).name === 'AbortError' || /aborted|timed?\s*out/i.test((err as Error).message),
      'Error was abort/timeout'
    );
  }

  // Wait 150ms to allow TCP socket tear-down to register on the server
  await new Promise((r) => setTimeout(r, 150));
  localServer.close();

  assert.ok(serverSawAbort || serverSawClose, 'Server received abort or close signal on socket');
});

// Test 12: Respect Retry-After header
test('Retry-After header when provided is respected during backoff calculation', () => {
  const errWithSeconds = createMock503Error('Overloaded', '3');
  const parsedSec = parseGeminiError(errWithSeconds);
  assert.equal(parsedSec.isRetryable, true);
  assert.equal(parsedSec.retryAfterMs, 3000);

  const backoffDelay = calculateBackoff(1, parsedSec.retryAfterMs, 1000, true);
  assert.equal(backoffDelay, 3000, 'Backoff strictly used 3000ms from Retry-After');

  // Respects max delay cap (10000ms) to avoid retry storms
  const errWithHugeSec = createMock503Error('Overloaded', '60');
  const parsedHuge = parseGeminiError(errWithHugeSec);
  assert.equal(parsedHuge.retryAfterMs, 10000, 'Capped at 10000ms');
});

// Test 13: Duplicate error logging is suppressed across rapid polling cycles
test('Duplicate error logs are suppressed across rapid cycles', () => {
  const logs: string[] = [];
  const customLogger = (msg: string) => logs.push(msg);

  logConciseError('gemini', 503, 'Model overloaded', customLogger);
  logConciseError('gemini', 503, 'Model overloaded', customLogger);
  logConciseError('gemini', 503, 'Model overloaded', customLogger);

  assert.equal(logs.length, 1, 'Duplicate errors within suppression window must only be logged once');
});

// Test 14: Rule-based summary distinguishes unavailable data from zero detected events
test('Rule-based summary distinguishes unavailable data from zero detected events', () => {
  const base: AreaContext = {
    name: 'Test Site',
    lat: 20.0,
    lon: 78.0,
    radiusKm: 150,
    fires: { count: 0, totalFrp: 0, maxFrp: 0, live: true },
    airQualityStatus: 'unavailable',
    airQuality: null,
    deforestation: [],
  };

  const unavailableSummary = ruleBasedSummary(base);
  assert.match(unavailableSummary, /No high-confidence fire detections within 150 km/);
  assert.match(unavailableSummary, /Air-quality data is temporarily unavailable/);

  const noneNearbySummary = ruleBasedSummary({ ...base, airQualityStatus: 'none-nearby' });
  assert.match(noneNearbySummary, /No monitored city with an air-quality reading within 500 km/);
  assert.doesNotMatch(noneNearbySummary, /temporarily unavailable/);
});

// Test 15: Primary model success returns primary model metadata and diagnostic log
test('Multi-model: primary model succeeds without invoking secondary model', async () => {
  const diagLogs: GeminiDiagnosticLog[] = [];
  const calls: string[] = [];

  const summaryRes = await summarise(mockContext, {
    apiKey: 'test-valid-key',
    model: 'gemini-3.8-flash',
    secondaryModel: 'gemini-2.5-flash',
    runner: async ({ model }) => {
      calls.push(model);
      return { text: 'Primary model generated environmental brief.' };
    },
    diagnosticLogger: (log) => diagLogs.push(log),
  });

  assert.equal(summaryRes.source, 'gemini');
  assert.equal(summaryRes.model, 'gemini-3.8-flash');
  assert.equal(summaryRes.isSecondary, false);
  assert.deepEqual(summaryRes.modelsAttempted, ['gemini-3.8-flash']);
  assert.equal(summaryRes.fallback, undefined);
  assert.deepEqual(calls, ['gemini-3.8-flash']);

  assert.equal(diagLogs.length, 1);
  assert.equal(diagLogs[0].selectedModel, 'gemini-3.8-flash');
  assert.equal(diagLogs[0].fallback, false);
  assert.equal(diagLogs[0].httpStatus, 200);
});

// Test 16: Primary model fails with 503 and switches to secondary model successfully
test('Multi-model: primary 503 switches to secondary model and succeeds', async () => {
  const diagLogs: GeminiDiagnosticLog[] = [];
  const calls: { model: string; attempt: number }[] = [];
  let attempt = 0;

  const summaryRes = await summarise(mockContext, {
    apiKey: 'test-valid-key',
    model: 'gemini-3.8-flash',
    secondaryModel: 'gemini-2.5-flash',
    perModelAttempts: 1, // trigger model switch on first failure
    maxAttempts: 3,
    baseDelayMs: 1,
    jitter: false,
    sleep: async () => {},
    runner: async ({ model }) => {
      attempt++;
      calls.push({ model, attempt });
      if (model === 'gemini-3.8-flash') {
        throw createMock503Error('503 UNAVAILABLE: gemini-3.8-flash experiencing high demand');
      }
      return { text: 'Secondary gemini-2.5-flash generated environmental brief.' };
    },
    diagnosticLogger: (log) => diagLogs.push(log),
  });

  assert.equal(summaryRes.source, 'gemini');
  assert.equal(summaryRes.model, 'gemini-2.5-flash');
  assert.equal(summaryRes.isSecondary, true);
  assert.deepEqual(summaryRes.modelsAttempted, ['gemini-3.8-flash', 'gemini-2.5-flash']);
  assert.match(summaryRes.text, /Secondary gemini-2.5-flash generated/);

  assert.equal(diagLogs.length, 1);
  assert.equal(diagLogs[0].selectedModel, 'gemini-2.5-flash');
  assert.equal(diagLogs[0].primaryModel, 'gemini-3.8-flash');
  assert.equal(diagLogs[0].secondaryModel, 'gemini-2.5-flash');
  assert.equal(diagLogs[0].fallback, false);
  assert.equal(diagLogs[0].httpStatus, 200);
});

// Test 17: Primary model 504 deadline exceeded switches to secondary model and succeeds
test('Multi-model: primary 504 DEADLINE_EXCEEDED switches to secondary model and succeeds', async () => {
  const diagLogs: GeminiDiagnosticLog[] = [];
  const calls: string[] = [];

  const summaryRes = await summarise(mockContext, {
    apiKey: 'test-valid-key',
    model: 'gemini-3.8-flash',
    secondaryModel: 'gemini-2.5-flash',
    perModelAttempts: 1,
    maxAttempts: 3,
    baseDelayMs: 1,
    jitter: false,
    sleep: async () => {},
    runner: async ({ model }) => {
      calls.push(model);
      if (model === 'gemini-3.8-flash') {
        const err = new Error('504 Gateway Timeout: DEADLINE_EXCEEDED');
        (err as unknown as { status: number }).status = 504;
        throw err;
      }
      return { text: 'Secondary gemini-2.5-flash generated brief after 504.' };
    },
    diagnosticLogger: (log) => diagLogs.push(log),
  });

  assert.equal(summaryRes.source, 'gemini');
  assert.equal(summaryRes.model, 'gemini-2.5-flash');
  assert.equal(summaryRes.isSecondary, true);
  assert.deepEqual(summaryRes.modelsAttempted, ['gemini-3.8-flash', 'gemini-2.5-flash']);
  assert.equal(diagLogs[0].selectedModel, 'gemini-2.5-flash');
  assert.equal(diagLogs[0].httpStatus, 200);
});

// Test 18: Quota exhaustion (429) switches model; when both fail with 429, falls back with quota_exhausted
test('Multi-model: quota exhaustion (429) on primary recovers on secondary; both failing sets quota_exhausted', async () => {
  // Sub-case A: Primary 429, secondary succeeds
  const recoveryRes = await summarise(mockContext, {
    apiKey: 'test-valid-key',
    model: 'gemini-3.8-flash',
    secondaryModel: 'gemini-2.5-flash',
    perModelAttempts: 1,
    maxAttempts: 3,
    baseDelayMs: 1,
    jitter: false,
    sleep: async () => {},
    runner: async ({ model }) => {
      if (model === 'gemini-3.8-flash') {
        const err = new Error('429 RESOURCE_EXHAUSTED: Quota exceeded for gemini-3.8-flash');
        (err as unknown as { status: number }).status = 429;
        throw err;
      }
      return { text: 'Secondary recovered after 429.' };
    },
  });

  assert.equal(recoveryRes.source, 'gemini');
  assert.equal(recoveryRes.model, 'gemini-2.5-flash');
  assert.equal(recoveryRes.isSecondary, true);

  // Sub-case B: Both models fail with 429 -> clean rule-based fallback with quota_exhausted
  const diagLogs: GeminiDiagnosticLog[] = [];
  const fallbackRes = await summarise(mockContext, {
    apiKey: 'test-valid-key',
    model: 'gemini-3.8-flash',
    secondaryModel: 'gemini-2.5-flash',
    perModelAttempts: 1,
    maxAttempts: 2,
    baseDelayMs: 1,
    jitter: false,
    sleep: async () => {},
    runner: async () => {
      const err = new Error('429 RESOURCE_EXHAUSTED: Rate limit reached');
      (err as unknown as { status: number }).status = 429;
      throw err;
    },
    diagnosticLogger: (log) => diagLogs.push(log),
  });

  assert.equal(fallbackRes.source, 'rule-based');
  assert.equal(fallbackRes.fallback, true);
  assert.equal(fallbackRes.fallbackReason, 'quota_exhausted');
  assert.equal(diagLogs.length, 1);
  assert.equal(diagLogs[0].fallbackReason, 'quota_exhausted');
  assert.equal(diagLogs[0].httpStatus, 429);
});

// Test 19: Both models fail -> strictly bounded attempts (<= 3) and clean rule-based fallback
test('Multi-model: both models fail -> bounded attempts (<= 3) and rule-based fallback', async () => {
  let callCount = 0;
  const modelsCalled: string[] = [];
  const loggedErrors: string[] = [];

  const fallbackRes = await summarise(mockContext, {
    apiKey: 'test-valid-key',
    model: 'gemini-3.8-flash',
    secondaryModel: 'gemini-2.5-flash',
    perModelAttempts: 2,
    maxAttempts: 3,
    baseDelayMs: 1,
    jitter: false,
    sleep: async () => {},
    runner: async ({ model }) => {
      callCount++;
      modelsCalled.push(model);
      throw createMock503Error(`503 High load on ${model}`);
    },
    logger: (msg) => loggedErrors.push(msg),
  });

  assert.equal(callCount, 3, 'Must stop at exactly maxAttempts=3');
  assert.equal(fallbackRes.source, 'rule-based');
  assert.equal(fallbackRes.fallback, true);
  assert.equal(fallbackRes.fallbackReason, 'service_unavailable');
  assert.deepEqual(fallbackRes.modelsAttempted, ['gemini-3.8-flash', 'gemini-2.5-flash']);
  assert.equal(loggedErrors.length, 1, 'Only one error logged after exhausting retries');
});

// Test 20: Structured diagnostic logs and error sanitization never leak API keys
test('Structured diagnostic logs never expose API keys or secrets', async () => {
  const sensitiveKey = 'AIzaSySecretProductionCredential987';
  const capturedLogs: GeminiDiagnosticLog[] = [];

  await summarise(mockContext, {
    apiKey: sensitiveKey,
    model: 'gemini-3.8-flash',
    secondaryModel: 'gemini-2.5-flash',
    maxAttempts: 1,
    runner: async () => {
      const err = new Error(`Authentication failure with key=${sensitiveKey}`);
      (err as unknown as { status: number }).status = 401;
      throw err;
    },
    diagnosticLogger: (log) => capturedLogs.push(log),
  });

  assert.equal(capturedLogs.length, 1);
  const log = capturedLogs[0];
  assert.equal(log.fallbackReason, 'invalid_key');
  assert.equal(log.httpStatus, 401);

  // Check all string fields of the diagnostic log for key leak
  const serialized = JSON.stringify(log);
  assert.doesNotMatch(serialized, new RegExp(sensitiveKey), 'API key must NEVER be in diagnostic log');
  assert.match(log.errorMessage || '', /\[REDACTED\]/);
});

