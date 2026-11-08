import { useEffect, useState, useRef } from 'react';
import { Sparkles, MapPin, Flame, Wind, TreeDeciduous, Crosshair, RefreshCw, AlertCircle, Info, ShieldCheck, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api, ApiError } from '@/lib/api';
import type { AiSummary, SelectedPlace, AqPointResult } from '@/types';

const ICON = { fire: Flame, air: Wind, forest: TreeDeciduous, point: Crosshair } as const;

// In-memory cache for coordinate air-quality queries to prevent duplicate requests
const pointAqCache = new Map<string, { data: AqPointResult; expires: number }>();

function getAqiBadgeColor(aqi?: number | null) {
  if (aqi == null) return 'bg-zinc-800 text-zinc-300 border-zinc-700';
  if (aqi > 200) return 'bg-purple-950/80 text-purple-300 border-purple-800/70';
  if (aqi > 150) return 'bg-red-950/80 text-red-300 border-red-800/70';
  if (aqi > 100) return 'bg-amber-950/80 text-amber-300 border-amber-800/70';
  if (aqi > 50) return 'bg-yellow-950/80 text-yellow-300 border-yellow-800/70';
  return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/70';
}

export function PlacePanel({ place }: { place: SelectedPlace | null }) {
  // AI summary state
  const [summary, setSummary] = useState<AiSummary | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [errorAi, setErrorAi] = useState<string | null>(null);

  // Exact coordinate atmospheric telemetry state
  const [pointAq, setPointAq] = useState<AqPointResult | null>(null);
  const [aqLoading, setAqLoading] = useState(false);
  const [aqError, setAqError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch true coordinate-based atmospheric data when coordinates change
  useEffect(() => {
    setSummary(null);
    setErrorAi(null);
    setLoadingAi(false);

    if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) {
      setPointAq(null);
      setAqError(null);
      setAqLoading(false);
      return;
    }

    const cacheKey = `${place.lat.toFixed(2)}:${place.lon.toFixed(2)}`;
    const cached = pointAqCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      setPointAq(cached.data);
      setAqError(null);
      setAqLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setAqLoading(true);
    setAqError(null);

    api<AqPointResult>(
      `/air-quality/point?lat=${place.lat.toFixed(4)}&lon=${place.lon.toFixed(4)}&name=${encodeURIComponent(place.name)}`,
      { signal: controller.signal }
    )
      .then((res) => {
        pointAqCache.set(cacheKey, { data: res, expires: Date.now() + 15 * 60 * 1000 });
        setPointAq(res);
        setAqError(null);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setPointAq(null);
        setAqError(
          err instanceof ApiError
            ? err.message
            : 'Atmospheric model telemetry currently unavailable for this coordinate.'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setAqLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [place?.lat, place?.lon, place?.name]);

  if (!place) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-6 text-[#9CAEA2]">
        <MapPin className="w-7 h-7 text-emerald-500/60 mb-2.5 animate-pulse" />
        <p className="text-[15px] font-semibold text-[#F2F5F2]">Select an Observation Point</p>
        <p className="text-xs mt-1 max-w-[17rem] leading-relaxed">
          Click any location across India to trigger high-resolution coordinate air-quality telemetry and generate an AI risk brief.
        </p>
      </div>
    );
  }

  const Icon = ICON[place.kind] || Crosshair;

  const analyse = async () => {
    setLoadingAi(true);
    setErrorAi(null);
    try {
      const res = await api<AiSummary>('/ai/summary', {
        method: 'POST',
        json: { name: place.name, lat: place.lat, lon: place.lon },
      });
      setSummary(res);
    } catch (e) {
      setErrorAi(e instanceof ApiError ? e.message : 'Could not generate the brief at this time.');
    } finally {
      setLoadingAi(false);
    }
  };

  const pt = pointAq?.point;

  return (
    <div className="p-4 sm:p-5 space-y-4">
      {/* Header with Title and Precise Coordinates */}
      <div className="flex items-start gap-3 pb-3 border-b border-emerald-950/80">
        <div className="w-10 h-10 rounded-xl bg-[#174C34]/60 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-500/40 shadow-sm">
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-[#F2F5F2] leading-snug break-words">
            {place.name}
          </h3>
          <p className="text-xs font-mono text-emerald-400 font-semibold mt-0.5">
            {place.lat.toFixed(4)}°N, {place.lon.toFixed(4)}°E
          </p>
        </div>
      </div>

      {/* Details List */}
      {place.details.length > 0 && (
        <ul className="space-y-1.5 text-xs leading-relaxed text-[#A8BCAE]">
          {place.details.map((d) => (
            <li key={d} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Coordinate-Based Atmospheric Telemetry Section */}
      <div className="rounded-xl bg-[#0D1914] border border-emerald-950 p-3.5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-emerald-950/60">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#F2F5F2]">
              Coordinate Atmospheric Telemetry
            </h4>
          </div>
          <span className="text-[10px] font-mono text-[#9CAEA2]">
            {aqLoading ? 'Querying CAMS…' : pt ? 'Verified Model' : 'No Data'}
          </span>
        </div>

        {aqLoading ? (
          <div className="space-y-2 py-1">
            <div className="h-6 rounded bg-emerald-900/30 animate-pulse w-3/4" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-10 rounded bg-emerald-900/20 animate-pulse" />
              <div className="h-10 rounded bg-emerald-900/20 animate-pulse" />
              <div className="h-10 rounded bg-emerald-900/20 animate-pulse" />
            </div>
          </div>
        ) : aqError ? (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-950/30 border border-red-900/50 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <div className="space-y-1">
              <span>{aqError}</span>
              <p className="text-[11px] text-[#9CAEA2]">
                Note: The system does not substitute unrelated city records when coordinate observations are unavailable.
              </p>
            </div>
          </div>
        ) : pt ? (
          <div className="space-y-3">
            {/* Primary US AQI & Category Banner */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#14251C] border border-emerald-900/60">
              <div>
                <span className="text-[10px] text-[#9CAEA2] uppercase font-semibold block">US AQI (Model Assimilation)</span>
                <span className="text-2xl font-bold font-mono text-[#F2F5F2] leading-tight">
                  {pt.usAqi != null ? pt.usAqi : '—'}
                </span>
              </div>
              <span className={`px-2.5 py-1 rounded text-xs font-semibold uppercase border ${getAqiBadgeColor(pt.usAqi)}`}>
                {pt.category}
              </span>
            </div>

            {/* Comprehensive 6-Pollutant Chemistry Grid */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded bg-[#101F18] border border-emerald-950/80">
                <span className="text-[10px] text-[#9CAEA2] block">PM2.5</span>
                <span className="font-mono font-semibold text-[#F2F5F2]">
                  {pt.pm25 != null ? `${pt.pm25} µg/m³` : '—'}
                </span>
              </div>

              <div className="p-2 rounded bg-[#101F18] border border-emerald-950/80">
                <span className="text-[10px] text-[#9CAEA2] block">PM10</span>
                <span className="font-mono font-semibold text-[#F2F5F2]">
                  {pt.pm10 != null ? `${pt.pm10} µg/m³` : '—'}
                </span>
              </div>

              <div className="p-2 rounded bg-[#101F18] border border-emerald-950/80">
                <span className="text-[10px] text-[#9CAEA2] block">NO₂</span>
                <span className="font-mono font-semibold text-[#F2F5F2]">
                  {pt.no2 != null ? `${pt.no2} µg/m³` : '—'}
                </span>
              </div>

              <div className="p-2 rounded bg-[#101F18] border border-emerald-950/80">
                <span className="text-[10px] text-[#9CAEA2] block">SO₂</span>
                <span className="font-mono font-semibold text-[#F2F5F2]">
                  {pt.so2 != null ? `${pt.so2} µg/m³` : '—'}
                </span>
              </div>

              <div className="p-2 rounded bg-[#101F18] border border-emerald-950/80">
                <span className="text-[10px] text-[#9CAEA2] block">CO</span>
                <span className="font-mono font-semibold text-[#F2F5F2]">
                  {pt.co != null ? `${pt.co} µg/m³` : '—'}
                </span>
              </div>

              <div className="p-2 rounded bg-[#101F18] border border-emerald-950/80">
                <span className="text-[10px] text-[#9CAEA2] block">O₃</span>
                <span className="font-mono font-semibold text-[#F2F5F2]">
                  {pt.o3 != null ? `${pt.o3} µg/m³` : '—'}
                </span>
              </div>
            </div>

            {/* Model Provenance and Time attribution */}
            <div className="pt-1 text-[11px] text-[#9CAEA2] space-y-0.5 border-t border-emerald-950/50">
              <p>
                <strong className="text-emerald-400">Source:</strong> Open-Meteo European CAMS Global Model
              </p>
              <p>
                <strong className="text-emerald-400">Run Time:</strong> {pt.time ? new Date(pt.time).toUTCString() : 'Hourly cycle'}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* AI Risk Brief Trigger Button */}
      <button
        type="button"
        onClick={analyse}
        disabled={loadingAi}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#174C34] to-[#1F6244] hover:from-[#1F6244] hover:to-[#2E8B57] disabled:opacity-60 disabled:cursor-wait border border-emerald-500/50 hover:border-emerald-400 text-sm font-bold text-[#F2F5F2] transition-all duration-200 cursor-pointer shadow-md shadow-emerald-950/50"
      >
        {loadingAi ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-emerald-300" />}
        <span>{loadingAi ? 'Synthesizing Brief…' : summary ? 'Regenerate AI Brief' : 'Generate AI Risk Brief'}</span>
      </button>

      {/* AI Summary Display */}
      <AnimatePresence mode="wait">
        {loadingAi && (
          <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2" aria-hidden="true">
            {[100, 92, 96, 70].map((w, i) => (
              <div key={i} className="h-3 rounded bg-emerald-900/40 animate-pulse" style={{ width: `${w}%` }} />
            ))}
          </motion.div>
        )}
        {errorAi && !loadingAi && (
          <motion.p key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-300 bg-red-950/40 border border-red-900/50 rounded-xl p-3" role="alert">
            {errorAi}
          </motion.p>
        )}
        {summary && !loadingAi && (
          <motion.div key="sum" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-3 pt-1">
            <div className="p-3.5 rounded-xl bg-[#0D1914] border border-emerald-950 text-xs text-[#F2F5F2] leading-relaxed whitespace-pre-line font-medium">
              {summary.summary}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className={`px-2 py-0.5 rounded border font-semibold ${summary.source === 'gemini' ? 'border-emerald-600/50 text-emerald-300 bg-emerald-950/60' : 'border-amber-700/50 text-amber-300 bg-amber-950/50'}`}>
                {summary.source === 'gemini' ? 'Gemini 3.8 Flash Synthesis' : 'Rule-Based Fallback'}
              </span>
              <span className="text-[#9CAEA2]">
                {summary.context.fires.count} fires in {summary.context.radiusKm} km · {new Date(summary.generatedAt).toLocaleTimeString()}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
export default PlacePanel;
