import React, { useState, useMemo } from 'react';
import { useDashboardContext } from '@/components/dashboard/DashboardLayout';
import { ShieldAlert, MapPin, Wind, Flame, TreeDeciduous, Info, Crosshair, ArrowRight } from 'lucide-react';
import type { SelectedPlace } from '@/types';

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

export const RiskAnalysisPage: React.FC = () => {
  const { fires, air, forest, selectedPlace, setSelectedPlace } = useDashboardContext();

  const [customLat, setCustomLat] = useState(selectedPlace?.lat?.toString() || '28.6139');
  const [customLon, setCustomLon] = useState(selectedPlace?.lon?.toString() || '77.2090');
  const [customName, setCustomName] = useState(selectedPlace?.name || 'Selected Target Location');
  const [analysisRadiusKm, setAnalysisRadiusKm] = useState<number>(200);

  const currentLat = selectedPlace?.lat ?? parseFloat(customLat) ?? 28.6139;
  const currentLon = selectedPlace?.lon ?? parseFloat(customLon) ?? 77.2090;

  const handleApplyCoordinates = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(customLat);
    const lon = parseFloat(customLon);
    if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      setSelectedPlace({
        name: customName || `Location (${lat.toFixed(3)}°, ${lon.toFixed(3)}°)`,
        lat,
        lon,
        kind: 'point',
        details: [`Coordinates: ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`],
      });
    }
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

  // Nearest Atmospheric Observation Node
  const nearestAirNode = useMemo(() => {
    const list = (air.data?.points ?? [])
      .map((p) => ({
        ...p,
        distanceKm: haversineDistance(currentLat, currentLon, p.lat, p.lon),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
    return list[0] || null;
  }, [air.data?.points, currentLat, currentLon]);

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
  // Transparent calculation: Base 10 + Air Contribution (up to 40) + Fire Contribution (up to 35) + Forest Reference (up to 15)
  const riskCalculation = useMemo(() => {
    const airAqi = nearestAirNode?.usAqi ?? 50;
    const airScore = Math.min(40, Math.round((airAqi / 300) * 40));

    const fireCount = nearbyFires.length;
    const maxFrp = nearbyFires.reduce((max, f) => Math.max(max, f.frp || 0), 0);
    const fireScore = Math.min(35, Math.round(fireCount * 3 + (maxFrp / 200) * 15));

    const closestForest = nearbyForestHotspots[0];
    const forestScore = closestForest && closestForest.distanceKm < 800 ? (closestForest.severity === 'Critical' ? 15 : 10) : 5;

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
  }, [nearestAirNode, nearbyFires, nearbyForestHotspots]);

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
              Select an observation coordinate or choose preset environmental surveillance targets.
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
              className="w-full px-3.5 py-2 rounded-lg bg-[#0D1914] border border-emerald-900/60 text-[15px] text-[#F2F5F2] focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-[14px] text-[#A8BCAE] block mb-1 font-medium">Longitude (°E/W)</label>
            <input
              type="number"
              step="any"
              value={customLon}
              onChange={(e) => setCustomLon(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-[#0D1914] border border-emerald-900/60 text-[15px] text-[#F2F5F2] focus:outline-none focus:border-emerald-500"
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
              Composite experimental vulnerability evaluation calculated directly from surrounding thermal fire clusters, closest Open-Meteo CAMS atmospheric simulation point, and GFW forest loss reference vectors.
            </p>
          </div>

          {/* Breakdown bars */}
          <div className="space-y-3.5 pt-4 border-t border-emerald-950/80">
            <div className="space-y-1.5">
              <div className="flex justify-between text-[14px]">
                <span className="text-[#A8BCAE]">Atmospheric Particulate Weight</span>
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
                <span className="text-[#A8BCAE]">Thermal Radiative Clusters</span>
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
                <span className="text-[#A8BCAE]">Curated Forest Loss Biome Buffer</span>
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
          {/* Nearest Air Observation Node */}
          <div className="p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-emerald-950/80">
              <div className="flex items-center gap-2">
                <Wind className="w-5 h-5 text-cyan-400" />
                <h4 className="text-[18px] sm:text-[19px] font-bold text-[#F2F5F2]">Nearest CAMS Atmospheric Station</h4>
              </div>
              <span className="text-[13px] text-cyan-300 font-semibold">
                {nearestAirNode ? `${nearestAirNode.distanceKm} km away` : 'No data'}
              </span>
            </div>

            {nearestAirNode ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-1 text-[14px]">
                <div>
                  <span className="text-[#9CAEA2] block text-[12px]">Location</span>
                  <span className="text-[#F2F5F2] font-bold text-[15px]">{nearestAirNode.name}</span>
                </div>
                <div>
                  <span className="text-[#9CAEA2] block text-[12px]">US AQI</span>
                  <span className="text-red-400 font-bold">{nearestAirNode.usAqi} ({nearestAirNode.category})</span>
                </div>
                <div>
                  <span className="text-[#9CAEA2] block text-[12px]">PM2.5 / PM10</span>
                  <span className="text-[#F2F5F2]">{nearestAirNode.pm25} / {nearestAirNode.pm10} µg/m³</span>
                </div>
                <div>
                  <span className="text-[#9CAEA2] block text-[12px]">Model Source</span>
                  <span className="text-emerald-400 font-semibold">Open-Meteo CAMS</span>
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

          {/* Forest Loss Reference Hotspots */}
          <div className="p-4 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-950/80">
              <div className="flex items-center gap-2">
                <TreeDeciduous className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-bold text-[#F2F5F2]">Closest Curated Forest Loss Hotspots (GFW)</h4>
              </div>
              <span className="text-xs font-mono text-purple-300">Reference Database</span>
            </div>

            <div className="space-y-2 pt-1">
              {nearbyForestHotspots.map((f) => (
                <div key={f.id} className="flex items-center justify-between text-xs p-2 rounded bg-[#0D1914] font-mono">
                  <span className="text-[#F2F5F2] font-sans font-medium">{f.name} ({f.country})</span>
                  <span className="text-purple-300">{f.severity} Loss</span>
                  <span className="text-[#9CAEA2]">{f.distanceKm} km away</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Limitations & Methodology Disclaimer */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-[#0D1914] border border-emerald-950/80 text-xs text-[#9CAEA2] leading-relaxed">
        <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-[#F2F5F2]">Scientific Methodology &amp; Mathematical Constraints:</p>
          <p>
            Distances are computed using the spherical Haversine formula over WGS84 geodesics. The Environmental Risk Index is an experimental composite proxy derived from active sensor inputs without claiming regulatory legal authority. Satellite passes are periodic (12–24h intervals) and cloud cover can obscure optical thermal sensors.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RiskAnalysisPage;

