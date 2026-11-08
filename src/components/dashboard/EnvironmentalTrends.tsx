import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { TrendingUp, Wind, Flame, Info } from 'lucide-react';
import type { AqResult, FireResult } from '@/types';

interface TrendsProps {
  air: AqResult | null;
  fires: FireResult | null;
  loading?: boolean;
}

export const EnvironmentalTrends: React.FC<TrendsProps> = ({
  air,
  fires,
  loading = false,
}) => {
  const [metricTab, setMetricTab] = useState<'air' | 'fire'>('air');

  // Top 10 cities by US AQI from the actual Open-Meteo CAMS data
  const airChartData = useMemo(() => {
    if (!air?.points || air.points.length === 0) return [];
    return [...air.points]
      .filter((p) => p.usAqi != null)
      .sort((a, b) => (b.usAqi ?? 0) - (a.usAqi ?? 0))
      .slice(0, 10)
      .map((p) => ({
        name: p.name.length > 10 ? p.name.slice(0, 9) + '…' : p.name,
        fullName: `${p.name}, ${p.country}`,
        usAqi: p.usAqi ?? 0,
        pm25: p.pm25 ?? 0,
        category: p.category,
      }));
  }, [air?.points]);

  // Top 10 thermal fire detections by radiative power (MW) from actual NASA FIRMS data
  const fireChartData = useMemo(() => {
    if (!fires?.points || fires.points.length === 0) return [];
    return [...fires.points]
      .sort((a, b) => (b.frp || 0) - (a.frp || 0))
      .slice(0, 10)
      .map((p, idx) => ({
        name: `#${idx + 1} (${p.satellite})`,
        fullName: `Detection at ${p.lat.toFixed(2)}°N, ${p.lon.toFixed(2)}°E (${p.satellite})`,
        frp: Math.round(p.frp || 0),
        confidence: p.confidence,
        acquired: p.acquired,
      }));
  }, [fires?.points]);

  const getAqiColor = (aqi: number) => {
    if (aqi > 200) return '#ef4444';
    if (aqi > 150) return '#f97316';
    if (aqi > 100) return '#eab308';
    return '#10B981';
  };

  return (
    <div className="rounded-xl bg-[#101F18] border border-emerald-950 p-5 shadow-sm space-y-4">
      {/* Header and Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-emerald-950/80">
        <div>
          <div className="flex items-center gap-2.5">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-[20px] sm:text-[22px] font-bold text-[#F2F5F2] tracking-tight">
              Environmental Telemetry Spectrum &amp; Trends
            </h3>
          </div>
          <p className="text-[14px] sm:text-[15px] text-[#9CAEA2] mt-1">
            Comparative analysis across active observation stations and thermal radiative clusters.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#0D1914] border border-emerald-950 self-start sm:self-center shrink-0">
          <button
            type="button"
            onClick={() => setMetricTab('air')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-[14px] font-medium transition-all ${
              metricTab === 'air'
                ? 'bg-[#14251C] text-emerald-300 border border-emerald-800/60'
                : 'text-[#9CAEA2] hover:text-[#F2F5F2]'
            }`}
          >
            <Wind className="w-4 h-4 text-cyan-400" />
            <span>Air Quality Index</span>
          </button>
          <button
            type="button"
            onClick={() => setMetricTab('fire')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-[14px] font-medium transition-all ${
              metricTab === 'fire'
                ? 'bg-[#14251C] text-orange-300 border border-emerald-800/60'
                : 'text-[#9CAEA2] hover:text-[#F2F5F2]'
            }`}
          >
            <Flame className="w-4 h-4 text-orange-400" />
            <span>Thermal FRP (MW)</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-72 pt-2">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="h-44 w-full rounded bg-emerald-900/10 animate-pulse" />
          </div>
        ) : metricTab === 'air' ? (
          airChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={airChartData} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#172D22" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#9CAEA2"
                  fontSize={12}
                  tickLine={false}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                />
                <YAxis stroke="#9CAEA2" fontSize={12} tickLine={false} domain={[0, 'auto']} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-[#0D1914] p-3.5 rounded-lg border border-emerald-900/80 text-[14px] shadow-xl space-y-1.5">
                        <p className="font-bold text-[#F2F5F2] text-[15px]">{d.fullName}</p>
                        <p className="text-emerald-300 font-semibold">US AQI: {d.usAqi}</p>
                        <p className="text-[#9CAEA2]">PM2.5: {d.pm25} µg/m³</p>
                        <p className="text-amber-300 text-[12px] uppercase font-semibold">Status: {d.category}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="usAqi" radius={[4, 4, 0, 0]}>
                  {airChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getAqiColor(entry.usAqi)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-[14px] text-[#9CAEA2] border border-dashed border-emerald-950 rounded-lg">
              <Info className="w-5 h-5 text-emerald-500/50 mb-1" />
              <span>No current air quality telemetry recorded.</span>
            </div>
          )
        ) : fireChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fireChartData} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#172D22" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#9CAEA2"
                fontSize={12}
                tickLine={false}
                interval={0}
                angle={-25}
                textAnchor="end"
              />
              <YAxis stroke="#9CAEA2" fontSize={12} tickLine={false} domain={[0, 'auto']} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-[#0D1914] p-3.5 rounded-lg border border-emerald-900/80 text-[14px] shadow-xl space-y-1.5">
                      <p className="font-bold text-[#F2F5F2] text-[15px]">{d.fullName}</p>
                      <p className="text-orange-400 font-semibold">Radiative Power: {d.frp} MW</p>
                      <p className="text-[#9CAEA2]">Confidence: {d.confidence}</p>
                      <p className="text-emerald-400 text-[12px]">Acquired: {d.acquired}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="frp" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-[14px] text-[#9CAEA2] border border-dashed border-emerald-950 rounded-lg">
            <Info className="w-5 h-5 text-emerald-500/50 mb-1" />
            <span>No thermal fire detections recorded in the current active window.</span>
          </div>
        )}
      </div>

      {/* Honest data provenance note */}
      <div className="flex items-center gap-2 text-[12px] sm:text-[13px] text-[#9CAEA2]/90 pt-2.5 border-t border-emerald-950/60 leading-normal">
        <Info className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          Metrics represent real-time measurements across the 45 world cities (CAMS) and NASA FIRMS 24-hour thermal detections. Multi-year historical timeseries requires prolonged ingestion.
        </span>
      </div>
    </div>
  );
};

export default EnvironmentalTrends;
