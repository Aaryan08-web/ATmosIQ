import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useDashboardContext } from '@/components/dashboard/DashboardLayout';
import { ShieldAlert, MapPin, Wind, Flame, TreeDeciduous, Info, Crosshair, ArrowRight, Activity, AlertCircle, RefreshCw } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { SelectedPlace, AqPointResult } from '@/types';

// In-memory cache for coordinate air-quality queries to prevent redundant calls
const pointAqCache = new Map<string, { data: AqPointResult; expires: number }>();

// Haversine formula for exact distance between two lat/lon points in kilometers
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function getAqiBadgeColor(aqi?: number | null) {
  if (aqi == null) return 'bg-zinc-800 text-zinc-300 border-zinc-700';
  if (aqi > 200) return 'bg-purple-950/80 text-purple-300 border-purple-800/70';
  if (aqi > 150) return 'bg-red-950/80 text-red-300 border-red-800/70';
  if (aqi > 100) return 'bg-amber-950/80 text-amber-300 border-amber-800/70';
  if (aqi > 50) return 'bg-yellow-950/80 text-yellow-300 border-yellow-800/70';
  return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/70';
}

export const RiskAnalysisPage: React.FC = () => {
  const { fires, air, forest, selectedPlace, setSelectedPlace } = useDashboardContext();

  const [customLat, setCustomLat] = useState(selectedPlace?.lat?.toString() || '28.6139');
  const [customLon, setCustomLon] = useState(selectedPlace?.lon?.toString() || '77.2090');
  const [customName, setCustomName] = useState(selectedPlace?.name || 'Selected Target Location');
  const [analysisRadiusKm, setAnalysisRadiusKm] = useState<number>(200);

  const currentLat = selectedPlace?.lat ?? parseFloat(customLat) ?? 28.6139;
  const currentLon = selectedPlace?.lon ?? parseFloat(customLon) ?? 77.2090;

  // Exact coordinate atmospheric telemetry state
  const [pointAq, setPointAq] = useState<AqPointResult | null>(null);
  const [aqLoading, setAqLoading] = useState(false);
  const [aqError, setAqError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch true coordinate-based atmospheric data when coordinates change
  useEffect(() => {
    if (!Number.isFinite(currentLat) || !Number.isFinite(currentLon)) {
      setPointAq(null);
      setAqError(null);
      setAqLoading(false);
      return;
    }

    const cacheKey = `${currentLat.toFixed(2)}:${currentLon.toFixed(2)}`;
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
      `/air-quality/point?lat=${currentLat.toFixed(4)}&lon=${currentLon.toFixed(4)}&name=${encodeURIComponent(customName)}`,
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
            : 'Atmospheric model telemetry currently unavailable for these coordinates.'
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
  }, [currentLat, currentLon, customName]);

  const handleApplyCoordinates = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(customLat);
    const lon = parseFloat(customLon);
    if (isNaN(lat) || isNaN(lon)) {
      setAqError('Please enter valid numeric latitude and longitude coordinates.');
      return;
    }
    if (lat < 6.5 || lat > 37.5 || lon < 68.0 || lon > 97.5) {
      setAqError(
        `ATmosIQ is restricted exclusively to the sovereign territory of India (Latitude 6.5°–37.5°N, Longitude 68.0°–97.5°E). Coordinates (${lat.toFixed(3)}°, ${lon.toFixed(3)}°) fall outside India.`
      );
      return;
    }
    setSelectedPlace({
      name: customName || `Indian Location (${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E)`,
      lat,
      lon,
      kind: 'point',
      details: [`Geographic coordinates: ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`],
    });
  };

  const setIndianPreset = (name: string, lat: number, lon: number) => {
    setCustomName(name);
    setCustomLat(lat.toString());
    setCustomLon(lon.toString());
    setSelectedPlace({
      name,
      lat,
      lon,
      kind: 'point',
      details: [`Geographic coordinates: ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`],
    });
  };

  // Nearby Fires Analysis
  const nearbyFires = useMemo(() => {
    return (fires.data?.points ?? [])
      .map((f) => ({
        ...f,
        distanceKm: haversineDistance(currentLat, currentLon, f.lat, f.lon),
      }))
      .filter((f) => f.distanceKm <= analysisRadiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [fires.data?.points, currentLat, currentLon, analysisRadiusKm]);

  // Nearby Live GFW Forest Alerts
  const nearbyLiveGfwAlerts = useMemo(() => {
    return (forest.data?.liveAlerts ?? [])
      .map((a) => ({
        ...a,
        distanceKm: haversineDistance(currentLat, currentLon, a.latitude, a.longitude),
      }))
      .filter((a) => a.distanceKm <= analysisRadiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [forest.data?.liveAlerts, currentLat, currentLon, analysisRadiusKm]);

  // Nearby Forest-Loss Reference Hotspots
  const nearbyForestHotspots = useMemo(() => {
    return (forest.data?.points ?? [])
      .map((f) => ({
        ...f,
        distanceKm: haversineDistance(currentLat, currentLon, f.lat, f.lon),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 3);
  }, [forest.data?.points, currentLat, currentLon]);

  // Evidence-Based Transparent Risk Score (0-100)
  // Transparent calculation: Base 10 + Coordinate Air Contribution (up to 40) + Fire Contribution (up to 35) + Forest Contribution (up to 15)
  const riskCalculation = useMemo(() => {
    const pt = pointAq?.point;
    const airAqi = pt?.usAqi != null ? pt.usAqi : 50;
    const airScore = Math.min(40, Math.round((airAqi / 300) * 40));

    const fireCount = nearbyFires.length;
    const maxFrp = nearbyFires.reduce((max, f) => Math.max(max, f.frp || 0), 0);
    const fireScore = Math.min(35, Math.round(fireCount * 3 + (maxFrp / 200) * 15));

    // Prefer live GFW alert within analysis buffer, fallback to curated reference proximity
    let forestScore = 5;
    if (nearbyLiveGfwAlerts.length > 0) {
      forestScore = nearbyLiveGfwAlerts[0].confidence === 'high' ? 15 : 12;
    } else {
      const closestForest = nearbyForestHotspots[0];
      forestScore = closestForest && closestForest.distanceKm < 800 ? (closestForest.severity === 'Critical' ? 12 : 8) : 5;
    }

    const totalScore = Math.min(100, Math.max(5, 10 + airScore + fireScore + forestScore));
    const level = totalScore > 75 ? 'Critical' : totalScore > 50 ? 'High' : totalScore > 30 ? 'Moderate' : 'Low';

    return {
      totalScore,
      level,
      breakdown: {
        baseline: 10,
        airScore,
        fireScore,
        forestScore,
      },
    };
  }, [pointAq?.point, nearbyFires, nearbyLiveGfwAlerts, nearbyForestHotspots]);

  const pt = pointAq?.point;

  return (
    <div className="space-y-8">
      {/* 1. Target Location Selection Bar */}
      <div className="p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-950/80">
          <div>
            <div className="flex items-center gap-2">
              <Crosshair className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-[#F2F5F2]">Spatial Location &amp; Vector Controls</h3>
            </div>
            <p className="text-xs text-[#9CAEA2] mt-0.5">
              Input precise geographic coordinates to retrieve synchronous multi-pollutant telemetry and nearby satellite anomalies.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#9CAEA2]">Radius Buffer:</span>
            <select
              value={analysisRadiusKm}
              onChange={(e) => setAnalysisRadiusKm(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg bg-[#14251C] border border-emerald-900/60 text-xs text-[#F2F5F2] font-mono cursor-pointer"
            >
              <option value={100}>100 km</option>
              <option value={200}>200 km</option>
              <option value={350}>350 km</option>
              <option value={500}>500 km</option>
            </select>
          </div>
        </div>

        {/* Input Coordinates Form */}
        <form onSubmit={handleApplyCoordinates} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] font-mono text-[#9CAEA2] block mb-1">Target Name</label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Observation point..."
              className="w-full px-3 py-1.5 rounded-lg bg-[#0D1914] border border-emerald-900/60 text-xs text-[#F2F5F2] focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-[14px] text-[#A8BCAE] block mb-1 font-medium">Latitude (°N/S)</label>
            <input
              type="number"
              step="any"
              value={customLat}
              onChange={(e) => setCustomLat(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-[#0D1914] border border-emerald-900/60 text-[15px] text-[#F2F5F2] focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
          <div>
            <label className="text-[14px] text-[#A8BCAE] block mb-1 font-medium">Longitude (°E/W)</label>
            <input
              type="number"
              step="any"
              value={customLon}
              onChange={(e) => setCustomLon(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-[#0D1914] border border-emerald-900/60 text-[15px] text-[#F2F5F2] focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg bg-[#174C34] hover:bg-[#1F6244] border border-emerald-600/70 text-[16px] font-bold text-[#F2F5F2] transition-colors cursor-pointer"
            >
              Analyze Coordinates
            </button>
          </div>
        </form>

        {/* Indian Location Presets */}
        <div className="pt-2 border-t border-emerald-950/60 flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-mono text-[#9CAEA2] uppercase tracking-wider">Indian Presets:</span>
          {[
            { name: 'Delhi NCR', lat: 28.6139, lon: 77.2090 },
            { name: 'Pune', lat: 18.5204, lon: 73.8567 },
            { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
            { name: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
            { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
            { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
            { name: 'Sundarbans', lat: 21.9500, lon: 88.8500 },
            { name: 'Western Ghats', lat: 11.4500, lon: 76.6500 },
          ].map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => setIndianPreset(preset.name, preset.lat, preset.lon)}
              className="px-2.5 py-1 rounded bg-[#0D1914] hover:bg-[#174C34] text-[12px] font-mono text-[#CBDAD0] hover:text-[#F2F5F2] border border-emerald-900/50 transition-colors"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Transparent Multi-Vector Risk Score Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Score Card */}
        <div className="lg:col-span-5 rounded-xl bg-[#101F18] border border-emerald-950 p-6 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold uppercase tracking-wider text-[#9CAEA2]">
                EVIDENCE-BASED RISK INDEX
              </span>
              <span
                className={`px-3 py-1 rounded text-[12px] font-semibold uppercase border ${
                  riskCalculation.level === 'Critical'
                    ? 'bg-red-950 text-red-300 border-red-800'
                    : riskCalculation.level === 'High'
                    ? 'bg-amber-950 text-amber-300 border-amber-800'
                    : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                }`}
              >
                {riskCalculation.level}
              </span>
            </div>

            <div className="flex items-baseline gap-2 pt-2">
              <span className="text-[52px] sm:text-[58px] font-bold text-[#F2F5F2] leading-none">
                {riskCalculation.totalScore}
              </span>
              <span className="text-[22px] text-[#9CAEA2]">/ 100</span>
            </div>

            <p className="text-[15px] sm:text-[16px] text-[#CBDAD0] leading-relaxed pt-1">
              Composite experimental vulnerability evaluation calculated directly from synchronous Open-Meteo CAMS atmospheric simulation at ({currentLat.toFixed(2)}°, {currentLon.toFixed(2)}°), surrounding thermal fire clusters, and Global Forest Watch canopy loss vectors.
            </p>
          </div>

          {/* Breakdown bars */}
          <div className="space-y-3.5 pt-4 border-t border-emerald-950/80">
            <div className="space-y-1.5">
              <div className="flex justify-between text-[14px]">
                <span className="text-[#A8BCAE]">Atmospheric Particulate Weight ({pt?.usAqi != null ? `${pt.usAqi} AQI` : 'Model'})</span>
                <span className="font-semibold text-[#F2F5F2]">{riskCalculation.breakdown.airScore} / 40</span>
              </div>
              <div className="h-2 rounded-full bg-emerald-950 overflow-hidden">
                <div
                  className="h-full bg-cyan-400 rounded-full"
                  style={{ width: `${(riskCalculation.breakdown.airScore / 40) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[14px]">
                <span className="text-[#A8BCAE]">Thermal Radiative Clusters ({nearbyFires.length} in buffer)</span>
                <span className="font-semibold text-[#F2F5F2]">{riskCalculation.breakdown.fireScore} / 35</span>
              </div>
              <div className="h-2 rounded-full bg-emerald-950 overflow-hidden">
                <div
                  className="h-full bg-orange-400 rounded-full"
                  style={{ width: `${(riskCalculation.breakdown.fireScore / 35) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[14px]">
                <span className="text-[#A8BCAE]">
                  Canopy Disturbance ({nearbyLiveGfwAlerts.length > 0 ? `${nearbyLiveGfwAlerts.length} live alerts` : 'Reference biome buffer'})
                </span>
                <span className="font-semibold text-[#F2F5F2]">{riskCalculation.breakdown.forestScore} / 15</span>
              </div>
              <div className="h-2 rounded-full bg-emerald-950 overflow-hidden">
                <div
                  className="h-full bg-purple-400 rounded-full"
                  style={{ width: `${(riskCalculation.breakdown.forestScore / 15) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Individual Contributing Measurements */}
        <div className="lg:col-span-7 space-y-4">
          {/* Exact Coordinate Air Observation Node */}
          <div className="p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-emerald-950/80">
              <div className="flex items-center gap-2">
                <Wind className="w-5 h-5 text-cyan-400" />
                <h4 className="text-[18px] sm:text-[19px] font-bold text-[#F2F5F2]">Coordinate Atmospheric Telemetry</h4>
              </div>
              <span className="text-[13px] text-cyan-300 font-semibold font-mono">
                {currentLat.toFixed(3)}°N, {currentLon.toFixed(3)}°E
              </span>
            </div>

            {aqLoading ? (
              <div className="space-y-2 py-3">
                <div className="h-6 rounded bg-emerald-900/30 animate-pulse w-2/3" />
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-10 rounded bg-emerald-900/20 animate-pulse" />
                  <div className="h-10 rounded bg-emerald-900/20 animate-pulse" />
                  <div className="h-10 rounded bg-emerald-900/20 animate-pulse" />
                </div>
              </div>
            ) : aqError ? (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/30 border border-red-900/50 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold">{aqError}</span>
                  <p className="text-[11px] text-[#9CAEA2]">
                    Data Integrity Guarantee: ATmosIQ does not substitute unrelated city records when coordinate observations are unavailable.
                  </p>
                </div>
              </div>
            ) : pt ? (
              <div className="space-y-3">
                {/* Primary AQI Banner */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#0D1914] border border-emerald-950">
                  <div>
                    <span className="text-[11px] text-[#9CAEA2] uppercase font-semibold block">US Air Quality Index</span>
                    <span className="text-3xl font-bold font-mono text-[#F2F5F2] leading-tight">
                      {pt.usAqi != null ? pt.usAqi : '—'}
                    </span>
                  </div>
                  <span className={`px-3 py-1 rounded text-xs font-semibold uppercase border ${getAqiBadgeColor(pt.usAqi)}`}>
                    {pt.category}
                  </span>
                </div>

                {/* 6-Pollutant Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded bg-[#0D1914] border border-emerald-950/80">
                    <span className="text-[11px] text-[#9CAEA2] block">PM2.5</span>
                    <span className="font-mono font-bold text-[#F2F5F2] text-[14px]">
                      {pt.pm25 != null ? `${pt.pm25} µg/m³` : '—'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-[#0D1914] border border-emerald-950/80">
                    <span className="text-[11px] text-[#9CAEA2] block">PM10</span>
                    <span className="font-mono font-bold text-[#F2F5F2] text-[14px]">
                      {pt.pm10 != null ? `${pt.pm10} µg/m³` : '—'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-[#0D1914] border border-emerald-950/80">
                    <span className="text-[11px] text-[#9CAEA2] block">NO₂</span>
                    <span className="font-mono font-bold text-[#F2F5F2] text-[14px]">
                      {pt.no2 != null ? `${pt.no2} µg/m³` : '—'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-[#0D1914] border border-emerald-950/80">
                    <span className="text-[11px] text-[#9CAEA2] block">SO₂</span>
                    <span className="font-mono font-bold text-[#F2F5F2] text-[14px]">
                      {pt.so2 != null ? `${pt.so2} µg/m³` : '—'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-[#0D1914] border border-emerald-950/80">
                    <span className="text-[11px] text-[#9CAEA2] block">CO</span>
                    <span className="font-mono font-bold text-[#F2F5F2] text-[14px]">
                      {pt.co != null ? `${pt.co} µg/m³` : '—'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-[#0D1914] border border-emerald-950/80">
                    <span className="text-[11px] text-[#9CAEA2] block">O₃</span>
                    <span className="font-mono font-bold text-[#F2F5F2] text-[14px]">
                      {pt.o3 != null ? `${pt.o3} µg/m³` : '—'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 text-[11px] text-[#9CAEA2] border-t border-emerald-950/50">
                  <span>Source: <strong className="text-emerald-400">Open-Meteo European CAMS Global Model</strong></span>
                  <span>Observation Cycle: {pt.time ? new Date(pt.time).toUTCString() : 'Hourly cycle'}</span>
                </div>
              </div>
            ) : (
              <p className="text-[14px] text-[#9CAEA2]">No atmospheric observation point in range.</p>
            )}
          </div>

          {/* Thermal Fire Proximity */}
          <div className="p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-emerald-950/80">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-400" />
                <h4 className="text-[18px] sm:text-[19px] font-bold text-[#F2F5F2]">Thermal Anomalies in {analysisRadiusKm} km Buffer</h4>
              </div>
              <span className="text-[14px] text-orange-400 font-bold">
                {nearbyFires.length} fire detections
              </span>
            </div>

            {nearbyFires.length > 0 ? (
              <div className="space-y-2.5 pt-1">
                {nearbyFires.slice(0, 3).map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-[14px] p-2.5 rounded bg-[#0D1914]">
                    <span className="text-[#F2F5F2] font-medium">
                      Pass at {f.lat.toFixed(2)}°N, {f.lon.toFixed(2)}°E ({f.satellite})
                    </span>
                    <span className="text-orange-400 font-bold">{Math.round(f.frp)} MW</span>
                    <span className="text-[#9CAEA2]">{f.distanceKm} km away</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#9CAEA2] py-2">
                Zero active VIIRS thermal anomalies detected within {analysisRadiusKm} km in the past 24 hours.
              </p>
            )}
          </div>

          {/* Forest Loss: Live Alerts & Curated Reference Hotspots */}
          <div className="p-4 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-950/80">
              <div className="flex items-center gap-2">
                <TreeDeciduous className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-bold text-[#F2F5F2]">Global Forest Watch Ingestion &amp; Reference</h4>
              </div>
              <span className="text-xs font-mono text-purple-300">
                {nearbyLiveGfwAlerts.length > 0 ? `${nearbyLiveGfwAlerts.length} Live Alerts` : 'Reference Biomes'}
              </span>
            </div>

            {nearbyLiveGfwAlerts.length > 0 ? (
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-mono text-purple-300 uppercase block font-semibold">
                  Live Satellite Canopy Disturbance Alerts:
                </span>
                {nearbyLiveGfwAlerts.slice(0, 3).map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-xs p-2 rounded bg-[#0D1914] font-mono">
                    <span className="text-[#F2F5F2] font-sans font-medium">
                      Alert at {a.latitude.toFixed(2)}°N, {a.longitude.toFixed(2)}°E ({a.alert_date})
                    </span>
                    <span className="text-purple-300 capitalize">{a.confidence} Confidence</span>
                    <span className="text-[#9CAEA2]">{a.distanceKm} km away</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-mono text-[#9CAEA2] uppercase block">
                  Closest Curated Reference Loss Hotspots (GFW Baseline):
                </span>
                {nearbyForestHotspots.map((f) => (
                  <div key={f.id} className="flex items-center justify-between text-xs p-2 rounded bg-[#0D1914] font-mono">
                    <span className="text-[#F2F5F2] font-sans font-medium">{f.name} ({f.country})</span>
                    <span className="text-purple-300">{f.severity} Loss</span>
                    <span className="text-[#9CAEA2]">{f.distanceKm} km away</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Limitations & Methodology Disclaimer */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-[#0D1914] border border-emerald-950/80 text-xs text-[#9CAEA2] leading-relaxed">
        <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-[#F2F5F2]">Scientific Methodology &amp; Mathematical Constraints:</p>
          <p>
            Distances are computed using the spherical Haversine formula over WGS84 geodesics. The Environmental Risk Index is an experimental composite proxy derived from active sensor inputs without claiming regulatory legal authority. Satellite passes are periodic (12–24h intervals) and cloud cover can obscure optical thermal sensors. Coordinate atmospheric values are computed from the Open-Meteo European CAMS multi-pollutant reanalysis grid.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RiskAnalysisPage;

