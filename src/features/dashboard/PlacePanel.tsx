import { useEffect, useState, useRef, useMemo } from 'react';
import { Sparkles, MapPin, Flame, Wind, TreeDeciduous, Crosshair, RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api, ApiError } from '@/lib/api';
import type { AiSummary, SelectedPlace, AqPointResult, FireResult, DeforestationResult } from '@/types';

const ICON = { fire: Flame, air: Wind, forest: TreeDeciduous, point: Crosshair } as const;

// In-memory cache for coordinate air-quality queries to prevent duplicate requests
const pointAqCache = new Map<string, { data: AqPointResult; expires: number }>();

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getAqiBadgeColor(aqi?: number | null) {
  if (aqi == null) return 'bg-zinc-800 text-zinc-300 border-zinc-700';
  if (aqi > 200) return 'bg-purple-950/80 text-purple-300 border-purple-800/70';
  if (aqi > 150) return 'bg-red-950/80 text-red-300 border-red-800/70';
  if (aqi > 100) return 'bg-amber-950/80 text-amber-300 border-amber-800/70';
  if (aqi > 50) return 'bg-yellow-950/80 text-yellow-300 border-yellow-800/70';
  return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/70';
}

interface PlacePanelProps {
  place: SelectedPlace | null;
  fires?: FireResult | null;
  forest?: DeforestationResult | null;
}

export function PlacePanel({ place, fires, forest }: PlacePanelProps) {
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

    // Sovereign India geographic boundary check (6.5°N - 37.5°N, 68.0°E - 97.5°E)
    if (place.lat < 6.5 || place.lat > 37.5 || place.lon < 68.0 || place.lon > 97.5) {
      setPointAq(null);
      setAqError('Target coordinates fall outside the Republic of India. Please select an observation location within Indian sovereign territory.');
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
            : 'Atmospheric telemetry currently unavailable for this coordinate.'
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

  // Proximity telemetry analysis within 150 km
  const radiusKm = 150;

  const nearbyFires = useMemo(() => {
    if (!place || !fires?.points) return [];
    return fires.points
      .map((f) => ({
        ...f,
        distance: haversineKm(place.lat, place.lon, f.lat, f.lon),
      }))
      .filter((f) => f.distance <= radiusKm)
      .sort((a, b) => b.frp - a.frp);
  }, [place, fires?.points]);

  const nearbyForestAlerts = useMemo(() => {
    if (!place) return { live: [], ref: [] };
    const live = (forest?.liveAlerts ?? [])
      .map((a) => ({
        ...a,
        distance: haversineKm(place.lat, place.lon, a.latitude, a.longitude),
      }))
      .filter((a) => a.distance <= radiusKm);

    const ref = (forest?.points ?? [])
      .map((p) => ({
        ...p,
        distance: haversineKm(place.lat, place.lon, p.lat, p.lon),
      }))
      .filter((p) => p.distance <= radiusKm);

    return { live, ref };
  }, [place, forest?.liveAlerts, forest?.points]);

  if (!place) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-6 sm:p-8 text-[#9CAEA2] min-h-[200px]">
        <div className="w-12 h-12 rounded-xl bg-[#14251C] border border-emerald-800/40 text-emerald-400 flex items-center justify-center mb-3 shadow-inner">
          <MapPin className="w-6 h-6 animate-pulse" />
        </div>
        <p className="text-sm font-semibold text-[#F2F5F2]">Select an Observation Point</p>
        <p className="text-xs text-[#9CAEA2] mt-1 max-w-xs leading-relaxed">
          Click any location across India to retrieve synchronous multi-pollutant telemetry, thermal anomaly buffers, and AI risk briefings.
        </p>
      </div>
    );
  }

  const Icon = ICON[place.kind] || Crosshair;
  const pt = pointAq?.point;

  // Composite Risk Assessment
  const riskStatus = (() => {
    const aqi = pt?.usAqi ?? 0;
    const fireCount = nearbyFires.length;
    const forestAlertCount = nearbyForestAlerts.live.length;

    if (aqi > 200 || fireCount > 8 || forestAlertCount > 2) {
      return { label: 'Critical Risk', variant: 'bg-red-950/80 text-red-300 border-red-800/70' };
    }
    if (aqi > 150 || fireCount > 3 || forestAlertCount > 0) {
      return { label: 'High Risk', variant: 'bg-orange-950/80 text-orange-300 border-orange-800/70' };
    }
    if (aqi > 100 || fireCount > 0) {
      return { label: 'Elevated Risk', variant: 'bg-amber-950/80 text-amber-300 border-amber-800/70' };
    }
    return { label: 'Normal Risk', variant: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/70' };
  })();

  const analyse = async (bypassCache = false) => {
    if (place.lat < 6.5 || place.lat > 37.5 || place.lon < 68.0 || place.lon > 97.5) {
      setErrorAi('Coordinates fall outside Indian sovereign territory.');
      return;
    }
    setLoadingAi(true);
    setErrorAi(null);
    try {
      const res = await api<AiSummary>('/ai/summary', {
        method: 'POST',
        json: { name: place.name, lat: place.lat, lon: place.lon, bypassCache },
      });
      setSummary(res);
    } catch (e) {
      setErrorAi(e instanceof ApiError ? e.message : 'Could not generate the brief at this time.');
    } finally {
      setLoadingAi(false);
    }
  };

  const peakFrp = nearbyFires.length > 0 ? Math.round(nearbyFires[0].frp) : null;
  const latestFireTime = nearbyFires.length > 0 ? nearbyFires[0].acquired : null;

  return (
    <div className="place-panel-container p-4 sm:p-5 space-y-4 min-w-0">
      {/* 1. Location Header & Risk Status */}
      <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-emerald-950/80 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-[#14251C] border border-emerald-800/60 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm sm:text-base font-semibold text-[#F2F5F2] leading-tight truncate" title={place.name}>
              {place.name}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-xs font-mono text-[#9CAEA2]">
              <span className="text-emerald-400 font-medium">
                {place.lat.toFixed(4)}°N, {place.lon.toFixed(4)}°E
              </span>
              <span className="text-emerald-900">•</span>
              <span>150 km buffer</span>
            </div>
          </div>
        </div>

        <span className={`shrink-0 px-2.5 py-1 rounded text-[11px] font-mono font-bold uppercase tracking-wider border shadow-sm ${riskStatus.variant}`}>
          {riskStatus.label}
        </span>
      </div>

      {/* 2. Three Environmental Pillars in a Responsive Container Grid */}
      <div className="place-panel-grid">
        {/* Pillar A: Air Quality */}
        <div className="p-3.5 rounded-xl bg-[#0D1914] border border-emerald-950/90 flex flex-col justify-between space-y-3 min-w-0 shadow-sm">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-emerald-950/60">
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4 text-cyan-400 shrink-0" />
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[#F2F5F2]">Air Quality</h4>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-[#101F18] border border-emerald-900/60 text-[10px] font-mono text-cyan-300">
                CAMS
              </span>
            </div>

            {aqLoading ? (
              <div className="space-y-2 py-3">
                <div className="h-6 rounded bg-emerald-900/30 animate-pulse w-2/3" />
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="h-10 rounded bg-emerald-900/20 animate-pulse" />
                  <div className="h-10 rounded bg-emerald-900/20 animate-pulse" />
                  <div className="h-10 rounded bg-emerald-900/20 animate-pulse" />
                </div>
              </div>
            ) : aqError ? (
              <div className="py-2.5 text-xs text-amber-300/90 flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Model Unavailable</p>
                  <p className="text-[11px] text-[#82978B]">Coordinate outside current active grid cycle.</p>
                </div>
              </div>
            ) : pt ? (
              <div className="space-y-2.5 pt-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-extrabold font-mono text-[#F2F5F2] leading-none">
                      {pt.usAqi != null ? pt.usAqi : '—'}
                    </span>
                    <span className="text-xs text-[#9CAEA2] font-medium uppercase font-mono">US AQI</span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider border shrink-0 ${getAqiBadgeColor(pt.usAqi)}`}>
                    {pt.category || 'Active'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-xs pt-0.5">
                  <div className="px-1.5 py-1.5 rounded-lg bg-[#101F18] border border-emerald-950/70 text-center">
                    <span className="text-[10px] text-[#9CAEA2] uppercase font-mono block">PM2.5</span>
                    <span className="font-mono font-bold text-[#F2F5F2] text-xs sm:text-sm block mt-0.5">
                      {pt.pm25 != null ? pt.pm25 : '—'}
                    </span>
                    <span className="text-[9px] text-[#82978B] block">µg/m³</span>
                  </div>
                  <div className="px-1.5 py-1.5 rounded-lg bg-[#101F18] border border-emerald-950/70 text-center">
                    <span className="text-[10px] text-[#9CAEA2] uppercase font-mono block">PM10</span>
                    <span className="font-mono font-bold text-[#F2F5F2] text-xs sm:text-sm block mt-0.5">
                      {pt.pm10 != null ? pt.pm10 : '—'}
                    </span>
                    <span className="text-[9px] text-[#82978B] block">µg/m³</span>
                  </div>
                  <div className="px-1.5 py-1.5 rounded-lg bg-[#101F18] border border-emerald-950/70 text-center">
                    <span className="text-[10px] text-[#9CAEA2] uppercase font-mono block">NO₂</span>
                    <span className="font-mono font-bold text-[#F2F5F2] text-xs sm:text-sm block mt-0.5">
                      {pt.no2 != null ? pt.no2 : '—'}
                    </span>
                    <span className="text-[9px] text-[#82978B] block">µg/m³</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#9CAEA2] py-2.5">No atmospheric observation point.</p>
            )}
          </div>

          <div className="text-[10px] text-[#82978B] pt-2 border-t border-emerald-950/50 flex items-center justify-between gap-2">
            <span className="truncate">Copernicus CAMS Model</span>
            <span className="shrink-0 font-mono">
              {pt?.time ? new Date(pt.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Hourly'}
            </span>
          </div>
        </div>

        {/* Pillar B: Fire Activity */}
        <div className="p-3.5 rounded-xl bg-[#0D1914] border border-emerald-950/90 flex flex-col justify-between space-y-3 min-w-0 shadow-sm">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-emerald-950/60">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400 shrink-0" />
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[#F2F5F2]">Fire Activity</h4>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-[#101F18] border border-emerald-900/60 text-[10px] font-mono text-orange-300">
                FIRMS
              </span>
            </div>

            <div className="space-y-2.5 pt-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold font-mono text-[#F2F5F2] leading-none">
                    {nearbyFires.length}
                  </span>
                  <span className="text-xs text-[#9CAEA2] font-medium">Detections in 150 km</span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider border shrink-0 ${
                    nearbyFires.length > 5
                      ? 'bg-red-950/80 text-red-300 border-red-800/60'
                      : nearbyFires.length > 0
                      ? 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                      : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                  }`}
                >
                  {nearbyFires.length > 5 ? 'High Cluster' : nearbyFires.length > 0 ? 'Active' : 'Nominal'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
                <div className="px-2.5 py-2 rounded-lg bg-[#101F18] border border-emerald-950/70">
                  <span className="text-[10px] text-[#9CAEA2] uppercase font-mono block">Peak Power</span>
                  <div className="text-xs sm:text-sm font-mono font-bold text-[#F2F5F2] mt-0.5">
                    {peakFrp != null ? `${peakFrp} MW` : 'None detected'}
                  </div>
                </div>
                <div className="px-2.5 py-2 rounded-lg bg-[#101F18] border border-emerald-950/70">
                  <span className="text-[10px] text-[#9CAEA2] uppercase font-mono block">Observation</span>
                  <div className="text-xs sm:text-sm font-mono font-bold text-[#F2F5F2] mt-0.5 truncate">
                    {latestFireTime ? new Date(latestFireTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Past 24h'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-[#82978B] pt-2 border-t border-emerald-950/50 flex items-center justify-between gap-2">
            <span className="truncate">NASA VIIRS 375m</span>
            <span className="shrink-0 font-mono">24h Window</span>
          </div>
        </div>

        {/* Pillar C: Forest Alerts */}
        <div className="p-3.5 rounded-xl bg-[#0D1914] border border-emerald-950/90 flex flex-col justify-between space-y-3 min-w-0 shadow-sm">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-emerald-950/60">
              <div className="flex items-center gap-2">
                <TreeDeciduous className="w-4 h-4 text-purple-400 shrink-0" />
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[#F2F5F2]">Forest Canopy</h4>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-[#101F18] border border-emerald-900/60 text-[10px] font-mono text-purple-300">
                GFW
              </span>
            </div>

            <div className="space-y-2.5 pt-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold font-mono text-[#F2F5F2] leading-none">
                    {nearbyForestAlerts.live.length}
                  </span>
                  <span className="text-xs text-[#9CAEA2] font-medium">Alerts in 150 km</span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider border shrink-0 ${
                    nearbyForestAlerts.live.length > 0
                      ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                      : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                  }`}
                >
                  {nearbyForestAlerts.live.length > 0 ? 'Disturbance' : 'Monitored'}
                </span>
              </div>

              <div className="px-2.5 py-2 rounded-lg bg-[#101F18] border border-emerald-950/70 text-xs">
                {nearbyForestAlerts.live.length > 0 ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#F2F5F2] font-medium truncate">Canopy disturbance trigger</span>
                    <span className="font-mono text-purple-300 text-[11px] shrink-0 capitalize">
                      {nearbyForestAlerts.live[0].confidence} conf
                    </span>
                  </div>
                ) : nearbyForestAlerts.ref.length > 0 ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#F2F5F2] font-medium truncate">{nearbyForestAlerts.ref[0].name}</span>
                    <span className="font-mono text-[#9CAEA2] text-[11px] shrink-0">
                      {nearbyForestAlerts.ref[0].distance.toFixed(0)} km away
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-[#9CAEA2] flex items-center gap-1.5 py-0.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>No canopy disturbance in 150 km buffer</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="text-[10px] text-[#82978B] pt-2 border-t border-emerald-950/50 flex items-center justify-between gap-2">
            <span className="truncate">Global Forest Watch Ingestion</span>
            <span className="shrink-0 font-mono">Verified AOI</span>
          </div>
        </div>
      </div>

      {/* 3. AI Risk Brief Action Button & Structured Output */}
      <div className="space-y-3 pt-1">
        <button
          type="button"
          onClick={() => analyse()}
          disabled={loadingAi}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#174C34] to-[#1F6244] hover:from-[#1F6244] hover:to-[#2E8B57] disabled:opacity-60 disabled:cursor-wait border border-emerald-500/50 hover:border-emerald-400 text-xs sm:text-sm font-semibold text-[#F2F5F2] transition-all duration-200 cursor-pointer shadow-md shadow-emerald-950/50"
        >
          {loadingAi ? (
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-300" />
          ) : (
            <Sparkles className="w-4 h-4 text-emerald-300" />
          )}
          <span>
            {loadingAi
              ? 'Synthesizing Environmental Intelligence…'
              : summary
              ? 'Regenerate AI Risk Brief'
              : 'Generate AI Environmental Brief'}
          </span>
        </button>

        <AnimatePresence mode="wait">
          {loadingAi && (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2 p-3.5 rounded-xl bg-[#0D1914] border border-emerald-950/70"
              aria-hidden="true"
            >
              {[100, 92, 96, 70].map((w, i) => (
                <div key={i} className="h-2.5 rounded bg-emerald-900/40 animate-pulse" style={{ width: `${w}%` }} />
              ))}
            </motion.div>
          )}

          {errorAi && !loadingAi && (
            <motion.div
              key="err"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-red-300 bg-red-950/40 border border-red-900/50 rounded-xl p-3 flex items-start gap-2"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorAi}</span>
            </motion.div>
          )}

          {summary && !loadingAi && (
            <motion.div
              key="sum"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-3 p-4 rounded-xl bg-[#0D1914] border border-emerald-950 shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-emerald-950/80 pb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold font-mono uppercase tracking-wider text-[#F2F5F2]">
                    Executive Risk Brief
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded border text-[10px] font-mono ${
                    summary.source === 'gemini'
                      ? 'bg-emerald-950/80 border-emerald-800/60 text-emerald-300'
                      : 'bg-amber-950/80 border-amber-800/60 text-amber-300'
                  }`}
                >
                  {summary.source === 'gemini'
                    ? 'Gemini Intelligence'
                    : summary.fallback
                      ? 'Rule-Based Fallback'
                      : 'Rule-Based Protocol'}
                </span>
              </div>

              {summary.fallback && (
                <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-900/60 text-[11px] text-amber-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      {summary.fallbackReason === 'invalid_key'
                        ? 'AI key unconfigured · Showing sensor fallback'
                        : 'AI unavailable · Showing sensor fallback'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => analyse(true)}
                    disabled={loadingAi}
                    className="text-amber-300 hover:text-amber-100 font-semibold underline text-[10px] cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              <div className="text-xs text-[#CBDAD0] leading-relaxed whitespace-pre-line font-medium">
                {summary.summary}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#9CAEA2] pt-2 border-t border-emerald-950/60 font-mono">
                <span>
                  Telemetry Context: {summary.context.fires.count} thermal clusters in {summary.context.radiusKm} km
                </span>
                <span>{new Date(summary.generatedAt).toLocaleTimeString()}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default PlacePanel;
