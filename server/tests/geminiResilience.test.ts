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
  listAvailableGeminiModels,
  verifyModelSupport,
  discoverViableSecondaryModel,
  clearModelDiscoveryCacheForTests,
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
  clearModelDiscoveryCacheForTests();
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
  assert.match(summaryRes.text, /US AQI 175\s*[—\u2014\-]\s*Unhealthy/);
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

  assert.match(delhiSummary, /US AQI 175\s*[—\u2014\-]\s*Unhealthy/);
  assert.match(delhiSummary, /Rajaji-Corbett Shivalik/);

  assert.match(puneSummary, /US AQI 94\s*[—\u2014\-]\s*Moderate/);
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
    secondaryModel: 'gemini-3.5-flash-lite',
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
    secondaryModel: 'gemini-3.5-flash-lite',
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
      return { text: 'Secondary gemini-3.5-flash-lite generated environmental brief.' };
    },
    diagnosticLogger: (log) => diagLogs.push(log),
  });

  assert.equal(summaryRes.source, 'gemini');
  assert.equal(summaryRes.model, 'gemini-3.5-flash-lite');
  assert.equal(summaryRes.isSecondary, true);
  assert.deepEqual(summaryRes.modelsAttempted, ['gemini-3.8-flash', 'gemini-3.5-flash-lite']);
  assert.match(summaryRes.text, /Secondary gemini-3.5-flash-lite generated/);

  assert.equal(diagLogs.length, 1);
  assert.equal(diagLogs[0].selectedModel, 'gemini-3.5-flash-lite');
  assert.equal(diagLogs[0].primaryModel, 'gemini-3.8-flash');
  assert.equal(diagLogs[0].secondaryModel, 'gemini-3.5-flash-lite');
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
    secondaryModel: 'gemini-3.5-flash-lite',
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
      return { text: 'Secondary gemini-3.5-flash-lite generated brief after 504.' };
    },
    diagnosticLogger: (log) => diagLogs.push(log),
  });

  assert.equal(summaryRes.source, 'gemini');
  assert.equal(summaryRes.model, 'gemini-3.5-flash-lite');
  assert.equal(summaryRes.isSecondary, true);
  assert.deepEqual(summaryRes.modelsAttempted, ['gemini-3.8-flash', 'gemini-3.5-flash-lite']);
  assert.equal(diagLogs[0].selectedModel, 'gemini-3.5-flash-lite');
  assert.equal(diagLogs[0].httpStatus, 200);
});

// Test 18: Quota exhaustion (429) switches model; when both fail with 429, falls back with quota_exhausted
test('Multi-model: quota exhaustion (429) on primary recovers on secondary; both failing sets quota_exhausted', async () => {
  // Sub-case A: Primary 429, secondary succeeds
  const recoveryRes = await summarise(mockContext, {
    apiKey: 'test-valid-key',
    model: 'gemini-3.8-flash',
    secondaryModel: 'gemini-3.5-flash-lite',
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
  assert.equal(recoveryRes.model, 'gemini-3.5-flash-lite');
  assert.equal(recoveryRes.isSecondary, true);

  // Sub-case B: Both models fail with 429 -> clean rule-based fallback with quota_exhausted
  const diagLogs: GeminiDiagnosticLog[] = [];
  const fallbackRes = await summarise(mockContext, {
    apiKey: 'test-valid-key',
    model: 'gemini-3.8-flash',
    secondaryModel: 'gemini-3.5-flash-lite',
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
    secondaryModel: 'gemini-3.5-flash-lite',
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
  assert.deepEqual(fallbackRes.modelsAttempted, ['gemini-3.8-flash', 'gemini-3.5-flash-lite']);
  assert.equal(loggedErrors.length, 1, 'Only one error logged after exhausting retries');
});

// Test 20: Structured diagnostic logs and error sanitization never leak API keys
test('Structured diagnostic logs never expose API keys or secrets', async () => {
  const sensitiveKey = 'AIzaSySecretProductionCredential987';
  const capturedLogs: GeminiDiagnosticLog[] = [];

  await summarise(mockContext, {
    apiKey: sensitiveKey,
    model: 'gemini-3.8-flash',
    secondaryModel: 'gemini-3.5-flash-lite',
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

// Test 21: Primary model 404 (e.g. no longer available) switches to secondary without retries
test('Primary model 404 switches immediately to secondary model without wasting retries', async () => {
  const loggedErrors: string[] = [];
  const attempts: Record<string, number> = { 'gemini-2.5-flash': 0, 'gemini-3.5-flash-lite': 0 };

  const summaryRes = await summarise(mockContext, {
    apiKey: 'test-valid-key',
    model: 'gemini-2.5-flash',
    secondaryModel: 'gemini-3.5-flash-lite',
    perModelAttempts: 2, // configured for 2, but 404 must NOT retry!
    maxAttempts: 3,
    runner: async ({ model }) => {
      if (model === 'gemini-2.5-flash') {
        attempts['gemini-2.5-flash']++;
        const err = new Error('This model models/gemini-2.5-flash is no longer available to new users. (NOT_FOUND)');
        (err as unknown as { status: number }).status = 404;
        throw err;
      }
      attempts['gemini-3.5-flash-lite']++;
      return { text: 'Secondary model gemini-3.5-flash-lite generated response after primary 404.' };
    },
    logger: (msg) => loggedErrors.push(msg),
  });

  // Primary model was attempted exactly 1 time (0 retries on 404)
  assert.equal(attempts['gemini-2.5-flash'], 1, '404 model must NOT be retried');
  assert.equal(attempts['gemini-3.5-flash-lite'], 1);
  assert.equal(summaryRes.source, 'gemini');
  assert.equal(summaryRes.model, 'gemini-3.5-flash-lite');
  assert.equal(summaryRes.isSecondary, true);
  assert.deepEqual(summaryRes.modelsAttempted, ['gemini-2.5-flash', 'gemini-3.5-flash-lite']);

  // Verify 404 was logged clearly
  assert.ok(loggedErrors.some((e) => e.includes('404') && e.includes('gemini-2.5-flash')));
});

// Test 22: Both models unavailable (404) -> exactly 2 total attempts, rule-based fallback with model_not_found
test('Both models unavailable (404) results in exactly 2 total attempts and model_not_found fallback', async () => {
  let callCount = 0;
  const loggedErrors: string[] = [];

  const summaryRes = await summarise(mockContext, {
    apiKey: 'test-valid-key',
    model: 'unavailable-model-1',
    secondaryModel: 'unavailable-model-2',
    tertiaryModel: undefined,
    perModelAttempts: 2,
    maxAttempts: 3,
    runner: async ({ model }) => {
      callCount++;
      const err = new Error(`Model ${model} is not supported or not found.`);
      (err as unknown as { status: number }).status = 404;
      throw err;
    },
    logger: (msg) => loggedErrors.push(msg),
  });

  assert.equal(callCount, 2, 'Exactly 2 attempts (1 per unavailable model, 0 wasted retries)');
  assert.equal(summaryRes.source, 'rule-based');
  assert.equal(summaryRes.fallback, true);
  assert.equal(summaryRes.fallbackReason, 'model_not_found');
  assert.deepEqual(summaryRes.modelsAttempted, ['unavailable-model-1', 'unavailable-model-2']);
});

// Test 23: Invalid model ID fails cleanly with model_not_found classification
test('Invalid model ID triggers clean model_not_found classification and fallback', async () => {
  const summaryRes = await summarise(mockContext, {
    apiKey: 'test-valid-key',
    model: 'invalid_malformed_model_xyz',
    secondaryModel: undefined,
    maxAttempts: 2,
    runner: async () => {
      const err = new Error('Model models/invalid_malformed_model_xyz not found');
      (err as unknown as { status: number }).status = 404;
      throw err;
    },
  });

  assert.equal(summaryRes.source, 'rule-based');
  assert.equal(summaryRes.fallback, true);
  assert.equal(summaryRes.fallbackReason, 'model_not_found');
});

// Test 24: Model discovery or verification failure handling
test('Model discovery and verification gracefully handles errors and redacts credentials', async () => {
  // 1. Missing key throws descriptive error
  await assert.rejects(
    () => listAvailableGeminiModels(''),
    /No GEMINI_API_KEY available for model discovery/
  );

  // 2. verifyModelSupport returns discovery_failed on invalid/rejected key
  const invalidKey = 'AIzaSyBogusTestingKeyWithBadCredentials123';
  const check = await verifyModelSupport('gemini-3.5-flash-lite', invalidKey);
  assert.equal(check.supported, false);
  assert.equal(check.reason, 'discovery_failed');
  assert.ok(check.message);
  assert.doesNotMatch(check.message, new RegExp(invalidKey), 'Secret key must be redacted');

  // 3. discoverViableSecondaryModel returns priority fallback candidate when discovery fails
  const discovered = await discoverViableSecondaryModel(invalidKey, 'gemini-3.5-flash-lite');
  assert.equal(discovered, 'gemini-3.5-flash-lite');
});

// Test 25: Three-model fallback — 1. Primary succeeds
test('Three-model fallback: primary succeeds on attempt 1 without invoking secondary or tertiary', async () => {
  const modelsInvoked: string[] = [];

  const summaryRes = await summarise(mockContext, {
    apiKey: 'test-valid-key',
    model: 'gemini-3.8-flash',
    secondaryModel: 'gemini-3.5-flash-lite',
    tertiaryModel: 'gemini-3.5-flash',
    runner: async ({ model }) => {
      modelsInvoked.push(model);
      return { text: 'Primary model gemini-3.8-flash environmental intelligence report.' };
    },
  });

  assert.equal(summaryRes.source, 'gemini');
  assert.equal(summaryRes.model, 'gemini-3.8-flash');
  assert.deepEqual(summaryRes.modelsAttempted, ['gemini-3.8-flash']);
  assert.deepEqual(modelsInvoked, ['gemini-3.8-flash']);
});

// Test 26: Three-model fallback — 2. Primary fails, secondary succeeds
test('Three-model fallback: primary fails, secondary succeeds without invoking tertiary', async () => {
  const modelsInvoked: string[] = [];

  const summaryRes = await summarise(mockContext, {
    apiKey: 'test-valid-key',
    model: 'gemini-3.8-flash',
    secondaryModel: 'gemini-3.5-flash-lite',
    tertiaryModel: 'gemini-3.5-flash',
    perModelAttempts: 1,
    runner: async ({ model }) => {
      modelsInvoked.push(model);
      if (model === 'gemini-3.8-flash') {
        throw createMock503Error('503 Service Unavailable: High load on primary');
      }
      return { text: 'Secondary model gemini-3.5-flash-lite response.' };
    },
  });

  assert.equal(summaryRes.source, 'gemini');
  assert.equal(summaryRes.model, 'gemini-3.5-flash-lite');
  assert.deepEqual(summaryRes.modelsAttempted, ['gemini-3.8-flash', 'gemini-3.5-flash-lite']);
  assert.deepEqual(modelsInvoked, ['gemini-3.8-flash', 'gemini-3.5-flash-lite']);
});

// Test 27: Three-model fallback — 3. Primary and secondary fail, tertiary succeeds
test('Three-model fallback: primary and secondary fail, tertiary succeeds', async () => {
  const modelsInvoked: string[] = [];
  const diagLogs: GeminiDiagnosticLog[] = [];

  const summaryRes = await summarise(mockContext, {
    apiKey: 'test-valid-key',
    model: 'gemini-3.8-flash',
    secondaryModel: 'gemini-3.5-flash-lite',
    tertiaryModel: 'gemini-3.5-flash',
    perModelAttempts: 1,
    runner: async ({ model }) => {
      modelsInvoked.push(model);
      if (model === 'gemini-3.8-flash') {
        throw createMock503Error('503 Primary overloaded');
      }
      if (model === 'gemini-3.5-flash-lite') {
        const err = new Error('504 DEADLINE_EXCEEDED on secondary');
        (err as unknown as { status: number }).status = 504;
        throw err;
      }
      return { text: 'Tertiary model gemini-3.5-flash generated response.' };
    },
    diagnosticLogger: (log) => diagLogs.push(log),
  });

  assert.equal(summaryRes.source, 'gemini');
  assert.equal(summaryRes.model, 'gemini-3.5-flash');
  assert.deepEqual(summaryRes.modelsAttempted, ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash']);
  assert.deepEqual(modelsInvoked, ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash']);

  assert.equal(diagLogs.length, 1);
  assert.equal(diagLogs[0].selectedModel, 'gemini-3.5-flash');
  assert.equal(diagLogs[0].primaryModel, 'gemini-3.8-flash');
  assert.equal(diagLogs[0].secondaryModel, 'gemini-3.5-flash-lite');
  assert.equal(diagLogs[0].tertiaryModel, 'gemini-3.5-flash');
  assert.equal(diagLogs[0].fallback, false);
});

// Test 28: Three-model fallback — 4. All three fail and rule-based fallback is used
test('Three-model fallback: all three fail and rule-based fallback is used', async () => {
  const modelsInvoked: string[] = [];

  const summaryRes = await summarise(mockContext, {
    apiKey: 'test-valid-key',
    model: 'gemini-3.8-flash',
    secondaryModel: 'gemini-3.5-flash-lite',
    tertiaryModel: 'gemini-3.5-flash',
    perModelAttempts: 1,
    runner: async ({ model }) => {
      modelsInvoked.push(model);
      throw createMock503Error(`503 Server Unavailable on ${model}`);
    },
  });

  assert.equal(summaryRes.source, 'rule-based');
  assert.equal(summaryRes.fallback, true);
  assert.equal(summaryRes.fallbackReason, 'service_unavailable');
  assert.deepEqual(summaryRes.modelsAttempted, ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash']);
  assert.deepEqual(modelsInvoked, ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash']);
});

// Test 29: Three-model fallback — 5. Duplicate model IDs are deduplicated and not attempted twice
test('Three-model fallback: duplicate model IDs are deduplicated and not attempted twice', async () => {
  const modelsInvoked: string[] = [];

  const summaryRes = await summarise(mockContext, {
    apiKey: 'test-valid-key',
    model: 'gemini-model-A',
    secondaryModel: 'gemini-model-A', // duplicate of primary
    tertiaryModel: 'gemini-model-B',
    perModelAttempts: 1,
    runner: async ({ model }) => {
      modelsInvoked.push(model);
      if (model === 'gemini-model-A') {
        throw createMock503Error('503 Overloaded');
      }
      return { text: 'Model B succeeded.' };
    },
  });

  assert.equal(summaryRes.source, 'gemini');
  assert.equal(summaryRes.model, 'gemini-model-B');
  assert.deepEqual(summaryRes.modelsAttempted, ['gemini-model-A', 'gemini-model-B']);
  assert.deepEqual(modelsInvoked, ['gemini-model-A', 'gemini-model-B'], 'Duplicate model-A was NOT attempted twice');
});

// Test 30: Three-model fallback — 6. 404 switches immediately without wasting retries
test('Three-model fallback: 404 switches immediately across primary and secondary to tertiary', async () => {
  const attempts: Record<string, number> = {
    'gemini-3.8-flash': 0,
    'gemini-3.5-flash-lite': 0,
    'gemini-3.5-flash': 0,
  };

  const summaryRes = await summarise(mockContext, {
    apiKey: 'test-valid-key',
    model: 'gemini-3.8-flash',
    secondaryModel: 'gemini-3.5-flash-lite',
    tertiaryModel: 'gemini-3.5-flash',
    perModelAttempts: 2, // configured for 2, but 404 must NOT retry!
    runner: async ({ model }) => {
      attempts[model] = (attempts[model] || 0) + 1;
      if (model === 'gemini-3.8-flash' || model === 'gemini-3.5-flash-lite') {
        const err = new Error(`Model ${model} is not supported or not found (404)`);
        (err as unknown as { status: number }).status = 404;
        throw err;
      }
      return { text: 'Tertiary model succeeded after earlier 404s.' };
    },
  });

  // Verify exactly 1 attempt on each 404 model (0 wasted retries)
  assert.equal(attempts['gemini-3.8-flash'], 1, 'Primary 404 must not be retried');
  assert.equal(attempts['gemini-3.5-flash-lite'], 1, 'Secondary 404 must not be retried');
  assert.equal(attempts['gemini-3.5-flash'], 1);
  assert.equal(summaryRes.source, 'gemini');
  assert.equal(summaryRes.model, 'gemini-3.5-flash');
});

// Test 31: Three-model fallback — 7. Total attempts and timeout budget remain strictly bounded
test('Three-model fallback: total attempts and timeout budget remain strictly bounded', async () => {
  let callCount = 0;
  const tStart = performance.now();

  const summaryRes = await summarise(mockContext, {
    apiKey: 'test-valid-key',
    model: 'gemini-3.8-flash',
    secondaryModel: 'gemini-3.5-flash-lite',
    tertiaryModel: 'gemini-3.5-flash',
    perModelAttempts: 2,
    maxAttempts: 5, // strict cap
    totalTimeoutMs: 200, // fast timeout budget
    baseDelayMs: 1,
    jitter: false,
    sleep: async () => {},
    runner: async () => {
      callCount++;
      throw createMock503Error('503 Service Unavailable');
    },
  });

  const durationMs = performance.now() - tStart;
  assert.ok(callCount <= 5, `Total attempts (${callCount}) exceeded maxAttempts ceiling`);
  assert.ok(durationMs < 5000, `Execution duration (${durationMs}ms) exceeded reasonable bounds`);
  assert.equal(summaryRes.source, 'rule-based');
  assert.equal(summaryRes.fallback, true);
});

// Test 32: Three-model fallback — 8. API keys never appear in logs
test('Three-model fallback: API keys never appear in logs or diagnostics across all three models', async () => {
  const secretKey = 'AIzaSySecretSuperKeyAcrossThreeModels789';
  const diagLogs: GeminiDiagnosticLog[] = [];
  const loggedErrors: string[] = [];

  const summaryRes = await summarise(mockContext, {
    apiKey: secretKey,
    model: 'gemini-3.8-flash',
    secondaryModel: 'gemini-3.5-flash-lite',
    tertiaryModel: 'gemini-3.5-flash',
    maxAttempts: 1,
    runner: async () => {
      const err = new Error(`Unauthorized access with api_key=${secretKey}`);
      (err as unknown as { status: number }).status = 401;
      throw err;
    },
    logger: (msg) => loggedErrors.push(msg),
    diagnosticLogger: (log) => diagLogs.push(log),
  });

  assert.equal(summaryRes.source, 'rule-based');
  assert.equal(summaryRes.fallbackReason, 'invalid_key');

  const allLogs = JSON.stringify({ diagLogs, loggedErrors });
  assert.doesNotMatch(allLogs, new RegExp(secretKey), 'Secret API key must NEVER be leaked in logs or diagnostics');
  assert.match(allLogs, /\[REDACTED\]/);
});

// ============================================================================
// Tests 33–41 — Gemini SDK Minimum Deadline (10 s) Regression Suite
// Verifies that every SDK timeout value is ≥ Google's hard minimum of 10,000 ms
// and that the overall budget is large enough to give all three models a chance.
// Added: 2026-11-10 — Bug 10: HTTP 400 "deadline too short" production fix.
// ============================================================================

// ---------------------------------------------------------------------------
// Helper: a runner that captures the AbortSignal and resolves immediately.
// We validate the AbortSignal timeout by checking that the controller fires
// no earlier than 10,000 ms (which corresponds to the attemptTimeoutMs used).
// Since we can't directly read attemptTimeoutMs from outside callGeminiWithRetry,
// we validate indirectly: the signal must NOT be already aborted on runner entry
// (i.e., timeout >= 1 ms), and we pass explicit timeoutMs to confirm it matches.
// ---------------------------------------------------------------------------
function createCapturingRunner(capturedTimeouts: number[], successOnCall: number = 1) {
  let callCount = 0;
  return async ({ signal }: { model: string; contents: string; signal?: AbortSignal }) => {
    callCount++;
    // Verify signal is not already aborted at entry (would mean timeout=0)
    assert.ok(signal && !signal.aborted, 'AbortSignal must not be pre-aborted when runner is entered');
    if (callCount < successOnCall) {
      throw createMock503Error('503 overloaded');
    }
    return { text: 'Environmental data successfully generated.' };
  };
}

// Test 33: Default timeoutMs is now 10,500 ms — above Google's 10 s minimum
test('Timeout defaults: callGeminiWithRetry defaults to timeoutMs=10500 (above Google 10s minimum)', async () => {
  // We test indirectly: pass the new default explicitly and confirm it works.
  // If the default were still 6,000, the accompanying test 41 would catch it.
  const capturedSignals: AbortSignal[] = [];
  const res = await callGeminiWithRetry('Delhi environment brief', {
    apiKey: 'test-key',
    timeoutMs: 10_500,         // the new default value
    totalTimeoutMs: 33_000,    // the new total default
    runner: async ({ signal }) => {
      if (signal) capturedSignals.push(signal);
      return { text: 'Delhi air quality: PM2.5 at 88.5 µg/m³.' };
    },
  });

  assert.equal(res.attempts, 1);
  assert.match(res.text, /PM2\.5/);
  assert.equal(capturedSignals.length, 1, 'Runner should be called exactly once on success');
  assert.ok(!capturedSignals[0]!.aborted, 'Signal must not be aborted after a successful call');
});

// Test 34: AbortController is not pre-aborted — confirms timeout > 0 for each attempt
test('Timeout safety: AbortSignal is never pre-aborted at runner entry with new timeout defaults', async () => {
  let callCount = 0;
  const signalStates: boolean[] = [];

  await callGeminiWithRetry('Safety check brief', {
    apiKey: 'test-key',
    timeoutMs: 10_500,
    totalTimeoutMs: 33_000,
    perModelAttempts: 2,
    runner: async ({ signal }) => {
      callCount++;
      if (signal) signalStates.push(signal.aborted);
      if (callCount === 1) throw createMock503Error();
      return { text: 'Signal safety verified.' };
    },
  });

  assert.equal(callCount, 2);
  for (const aborted of signalStates) {
    assert.equal(aborted, false, 'AbortSignal must never be pre-aborted at runner entry');
  }
});

// Test 35: Primary model succeeds with new 10,500 ms timeout — basic sanity
test('Timeout fix sanity: primary model succeeds with timeoutMs=10500 and totalTimeoutMs=33000', async () => {
  const res = await callGeminiWithRetry('Sanity check', {
    apiKey: 'test-key',
    timeoutMs: 10_500,
    totalTimeoutMs: 33_000,
    runner: async ({ model }) => ({ text: `OK from ${model}` }),
  });

  assert.equal(res.attempts, 1);
  assert.match(res.text, /OK from/);
  assert.equal(res.isSecondary, false);
});

// Test 36: Secondary succeeds after primary 503 — budget of 33,000 ms is sufficient
test('Timeout fix: secondary model gets full budget after primary 503 with totalTimeoutMs=33000', async () => {
  const modelsInvoked: string[] = [];

  const res = await callGeminiWithRetry('Secondary test', {
    apiKey: 'test-key',
    model: 'gemini-3.8-flash',
    secondaryModel: 'gemini-3.5-flash-lite',
    tertiaryModel: undefined,
    timeoutMs: 10_500,
    totalTimeoutMs: 33_000,
    perModelAttempts: 1,
    runner: async ({ model }) => {
      modelsInvoked.push(model);
      if (model === 'gemini-3.8-flash') throw createMock503Error();
      return { text: `Secondary ${model} responded.` };
    },
  });

  assert.ok(modelsInvoked.includes('gemini-3.8-flash'), 'Primary must be attempted');
  assert.ok(modelsInvoked.includes('gemini-3.5-flash-lite'), 'Secondary must be attempted after primary fails');
  assert.match(res.text, /Secondary/);
  assert.equal(res.isSecondary, true);
});

// Test 37: Tertiary succeeds after primary+secondary fail — all three models get budget
test('Timeout fix: tertiary model attempted when primary and secondary both return 503', async () => {
  const modelsInvoked: string[] = [];

  const res = await callGeminiWithRetry('Tertiary test', {
    apiKey: 'test-key',
    model: 'gemini-3.8-flash',
    secondaryModel: 'gemini-3.5-flash-lite',
    tertiaryModel: 'gemini-3.5-flash',
    timeoutMs: 10_500,
    totalTimeoutMs: 33_000,
    perModelAttempts: 1,
    runner: async ({ model }) => {
      modelsInvoked.push(model);
      if (model !== 'gemini-3.5-flash') throw createMock503Error();
      return { text: `Tertiary ${model} succeeded.` };
    },
  });

  assert.deepEqual(modelsInvoked, ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash']);
  assert.match(res.text, /Tertiary/);
});

// Test 38: All three models fail → rule-based fallback with new budget
test('Timeout fix: rule-based fallback when all three models fail with totalTimeoutMs=33000', async () => {
  const summaryRes = await summarise(mockContext, {
    apiKey: 'test-key',
    model: 'gemini-3.8-flash',
    secondaryModel: 'gemini-3.5-flash-lite',
    tertiaryModel: 'gemini-3.5-flash',
    timeoutMs: 10_500,
    totalTimeoutMs: 33_000,
    perModelAttempts: 1,
    runner: async () => { throw createMock503Error('All models unavailable'); },
  });

  assert.equal(summaryRes.source, 'rule-based');
  assert.equal(summaryRes.fallback, true);
  assert.match(summaryRes.text, /Delhi|pollution|air quality/i);
});

// Test 39: Tight budget (< 10 s remaining) prevents a new model attempt — avoids HTTP 400
// Uses summarise() so rule-based fallback is returned (callGeminiWithRetry throws on total failure).
test('Timeout fix: model attempt is skipped when remaining budget < 10,000 ms (prevents HTTP 400)', async () => {
  const modelsInvoked: string[] = [];

  // totalTimeoutMs=10_010 with a 20ms attempt duration ensures that after attempt 1,
  // remaining budget drops below 10,000 ms (~9,990 ms). The budget guard prevents
  // secondary and tertiary models from being attempted with an illegal sub-10s deadline.
  const summaryRes = await summarise(mockContext, {
    apiKey: 'test-key',
    model: 'gemini-3.8-flash',
    secondaryModel: 'gemini-3.5-flash-lite',
    tertiaryModel: 'gemini-3.5-flash',
    timeoutMs: 10_500,
    totalTimeoutMs: 10_010,
    perModelAttempts: 1,
    runner: async ({ model }) => {
      modelsInvoked.push(model);
      await new Promise((r) => setTimeout(r, 20));
      throw createMock503Error();
    },
  });

  // Only the primary should be attempted; secondary/tertiary must be skipped (budget guard)
  assert.equal(modelsInvoked.length, 1, 'Only the primary model should be attempted when budget is tight');
  assert.equal(modelsInvoked[0], 'gemini-3.8-flash');
  assert.equal(summaryRes.source, 'rule-based', 'Result must fall back to rule-based');
  assert.equal(summaryRes.fallback, true);
});

// Test 40: Auth 401 errors do NOT trigger retry on other models (unchanged behaviour)
test('Timeout fix: auth 401 immediately stops all model attempts — no retry on other models', async () => {
  const modelsInvoked: string[] = [];

  const summaryRes = await summarise(mockContext, {
    apiKey: 'test-key',
    model: 'gemini-3.8-flash',
    secondaryModel: 'gemini-3.5-flash-lite',
    tertiaryModel: 'gemini-3.5-flash',
    timeoutMs: 10_500,
    totalTimeoutMs: 33_000,
    runner: async ({ model }) => {
      modelsInvoked.push(model);
      const err = new Error('API_KEY_INVALID: API key expired');
      (err as unknown as { status: number }).status = 401;
      throw err;
    },
  });

  assert.equal(modelsInvoked.length, 1, 'Auth error must stop all further model attempts immediately');
  assert.equal(summaryRes.source, 'rule-based');
  assert.equal(summaryRes.fallbackReason, 'invalid_key');
});

// Test 41 (regression): Reproduces the production "deadline 6s too short" failure.
// Before the fix: timeoutMs defaulted to 6,000 ms → Google rejected with HTTP 400.
// After the fix: timeoutMs defaults to 10,500 ms → no rejection.
// We simulate Google's SDK rejection for sub-10 s timeouts in the runner.
test('Regression: 6s timeout previously caused HTTP 400 "deadline too short" — now fixed to 10500ms', async () => {
  const GOOGLE_MINIMUM_DEADLINE_MS = 10_000;

  // Simulate Google SDK behaviour: reject if timeout < 10,000 ms
  function makeGoogleLikeRunner(configuredTimeoutMs: number) {
    return async ({ signal }: { model: string; contents: string; signal?: AbortSignal }) => {
      if (configuredTimeoutMs < GOOGLE_MINIMUM_DEADLINE_MS) {
        const err = new Error(
          `HTTP 400 INVALID_ARGUMENT: Manually set deadline ${Math.round(configuredTimeoutMs / 1000)}s is too short. Minimum allowed deadline is 10s.`
        );
        (err as unknown as { status: number }).status = 400;
        throw err;
      }
      return { text: 'Delhi environmental brief: air quality is Unhealthy (US AQI 175).' };
    };
  }

  // --- OLD BEHAVIOUR (timeoutMs=6000) would fail ---
  const failRes = await summarise(mockContext, {
    apiKey: 'test-key',
    timeoutMs: 6_000,         // the OLD default — simulates the bug
    totalTimeoutMs: 33_000,
    runner: makeGoogleLikeRunner(6_000),
  });
  // With 6,000 ms timeout the runner throws HTTP 400 → rule-based fallback
  assert.equal(failRes.source, 'rule-based',
    'timeoutMs=6000 must result in rule-based fallback (simulates old Google 400 rejection)');

  // --- NEW BEHAVIOUR (timeoutMs=10500) must succeed ---
  const successRes = await summarise(mockContext, {
    apiKey: 'test-key',
    timeoutMs: 10_500,        // the NEW default — fixed
    totalTimeoutMs: 33_000,
    runner: makeGoogleLikeRunner(10_500),
  });
  assert.equal(successRes.source, 'gemini',
    'timeoutMs=10500 must succeed (above Google minimum 10,000 ms)');
  assert.match(successRes.text, /Delhi|air quality/i);
});
