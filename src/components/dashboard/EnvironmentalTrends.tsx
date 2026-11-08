import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Line,
  ComposedChart,
  Legend,
} from 'recharts';
import { TrendingUp, Wind, Flame, Info, History, Clock, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import type { AqResult, FireResult, HistoryResult, EnvironmentalSnapshot } from '@/types';

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
  const [metricTab, setMetricTab] = useState<'air' | 'fire' | 'history'>('air');
  const [historyTimeFilter, setHistoryTimeFilter] = useState<'all' | '24h' | '6h'>('all');
  const [historyMetric, setHistoryMetric] = useState<'fires' | 'air'>('fires');
  const [snapshots, setSnapshots] = useState<EnvironmentalSnapshot[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Fetch historical snapshots when history tab is active or filter changes
  useEffect(() => {
    if (metricTab !== 'history') return;

    let since = 0;
    const now = Date.now();
    if (historyTimeFilter === '6h') {
      since = now - 6 * 60 * 60 * 1000;
    } else if (historyTimeFilter === '24h') {
      since = now - 24 * 60 * 60 * 1000;
    }

    setLoadingHistory(true);
    setHistoryError(null);

    api<HistoryResult>(`/history?limit=100&since=${since}`)
      .then((res) => {
        setSnapshots(res.snapshots || []);
        setHistoryError(null);
      })
      .catch((err) => {
        console.error('Failed to load history:', err);
        setHistoryError('Could not retrieve historical snapshots from SQLite database.');
      })
      .finally(() => {
        setLoadingHistory(false);
      });
  }, [metricTab, historyTimeFilter]);

  // Top 10 cities by US AQI from the actual Open-Meteo CAMS data
  const airChartData = useMemo(() => {
    if (!air?.points || air.points.length === 0) return [];
    return [...air.points]
      .filter((p) => p.usAqi != null)
      .sort((a, b) => (b.usAqi ?? 0) - (a.usAqi ?? 0))
      .slice(0, 10)
      .map((p) => ({
        name: p.name.length > 10 ? p.name.slice(0, 9) + '…' : p.name,
        fullName: `${p.name}, ${p.state ? `${p.state}, India` : p.country}`,
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

  // Historical snapshots formatted for chart rendering
  const historyChartData = useMemo(() => {
    return snapshots.map((s) => {
      const date = new Date(s.timestamp || s.created_at);
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return {
        id: s.id,
        label: `${dateStr} ${timeStr}`,
        timestamp: s.timestamp,
        fireCount: s.fire_count,
        totalFrp: s.total_frp ?? 0,
        worstAqi: s.worst_aqi ?? 0,
        unhealthyCount: s.unhealthy_aqi_count,
        worstCity: s.worst_city || 'N/A',
      };
    });
  }, [snapshots]);

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
            Comparative analysis across active observation stations, thermal clusters, and stored historical snapshots.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-[#0D1914] border border-emerald-950 self-start sm:self-center shrink-0">
          <button
            type="button"
            onClick={() => setMetricTab('air')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-[14px] font-medium transition-all cursor-pointer ${
              metricTab === 'air'
                ? 'bg-[#14251C] text-emerald-300 border border-emerald-800/60'
                : 'text-[#9CAEA2] hover:text-[#F2F5F2]'
            }`}
          >
            <Wind className="w-4 h-4 text-cyan-400" />
            <span>Air Quality</span>
          </button>
          <button
            type="button"
            onClick={() => setMetricTab('fire')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-[14px] font-medium transition-all cursor-pointer ${
              metricTab === 'fire'
                ? 'bg-[#14251C] text-orange-300 border border-emerald-800/60'
                : 'text-[#9CAEA2] hover:text-[#F2F5F2]'
            }`}
          >
            <Flame className="w-4 h-4 text-orange-400" />
            <span>Thermal FRP</span>
          </button>
          <button
            type="button"
            onClick={() => setMetricTab('history')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-[14px] font-medium transition-all cursor-pointer ${
              metricTab === 'history'
                ? 'bg-[#14251C] text-emerald-300 border border-emerald-800/60'
                : 'text-[#9CAEA2] hover:text-[#F2F5F2]'
            }`}
          >
            <History className="w-4 h-4 text-emerald-400" />
            <span>Historical Snapshots</span>
          </button>
        </div>
      </div>

      {/* Sub-controls for History Tab */}
      {metricTab === 'history' && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-lg bg-[#0D1914] border border-emerald-950/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#9CAEA2]">Metric:</span>
            <button
              type="button"
              onClick={() => setHistoryMetric('fires')}
              className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer ${
                historyMetric === 'fires'
                  ? 'bg-orange-950/80 text-orange-300 border border-orange-800/70'
                  : 'text-[#9CAEA2] hover:text-[#F2F5F2]'
              }`}
            >
              Fires &amp; Total FRP
            </button>
            <button
              type="button"
              onClick={() => setHistoryMetric('air')}
              className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer ${
                historyMetric === 'air'
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/70'
                  : 'text-[#9CAEA2] hover:text-[#F2F5F2]'
              }`}
            >
              Worst AQI &amp; Unhealthy Nodes
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#9CAEA2]">Time Window:</span>
            <div className="flex items-center gap-1">
              {(['all', '24h', '6h'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setHistoryTimeFilter(filter)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                    historyTimeFilter === filter
                      ? 'bg-[#14251C] text-emerald-300 font-bold border border-emerald-800/60'
                      : 'text-[#9CAEA2] hover:text-[#F2F5F2]'
                  }`}
                >
                  {filter === 'all' ? 'All Time' : filter === '24h' ? 'Last 24h' : 'Last 6h'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="w-full h-72 pt-2">
        {loading || (metricTab === 'history' && loadingHistory) ? (
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
        ) : metricTab === 'fire' ? (
          fireChartData.length > 0 ? (
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
          )
        ) : historyChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={historyChartData} margin={{ top: 10, right: 15, left: -15, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#172D22" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#9CAEA2"
                fontSize={11}
                tickLine={false}
                interval="preserveStartEnd"
                angle={-25}
                textAnchor="end"
              />
              <YAxis
                yAxisId="left"
                stroke="#9CAEA2"
                fontSize={11}
                tickLine={false}
                domain={[0, 'auto']}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#9CAEA2"
                fontSize={11}
                tickLine={false}
                domain={[0, 'auto']}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-[#0D1914] p-3.5 rounded-lg border border-emerald-900/80 text-[13px] shadow-xl space-y-1.5 font-sans">
                      <p className="font-bold text-[#F2F5F2] font-mono text-[14px]">{d.label}</p>
                      <div className="space-y-1 text-xs border-t border-emerald-950/70 pt-1.5">
                        <p className="text-orange-400">
                          Active Fires: <strong>{d.fireCount}</strong> · Total FRP: <strong>{d.totalFrp} MW</strong>
                        </p>
                        <p className="text-cyan-300">
                          Worst AQI: <strong>{d.worstAqi}</strong> ({d.worstCity})
                        </p>
                        <p className="text-amber-300">
                          Unhealthy Stations (&gt;150 AQI): <strong>{d.unhealthyCount}</strong>
                        </p>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                height={28}
                wrapperStyle={{ fontSize: '12px', color: '#9CAEA2' }}
              />
              {historyMetric === 'fires' ? (
                <>
                  <Bar
                    yAxisId="left"
                    dataKey="fireCount"
                    name="Fire Count"
                    fill="#f97316"
                    radius={[3, 3, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="totalFrp"
                    name="Total FRP (MW)"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#ef4444' }}
                  />
                </>
              ) : (
                <>
                  <Bar
                    yAxisId="left"
                    dataKey="worstAqi"
                    name="Worst AQI"
                    fill="#06b6d4"
                    radius={[3, 3, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="unhealthyCount"
                    name="Unhealthy Stations (>150)"
                    stroke="#eab308"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#eab308' }}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-[14px] text-[#9CAEA2] border border-dashed border-emerald-950 rounded-lg p-6 text-center space-y-1.5">
            <Clock className="w-6 h-6 text-emerald-400/60 mb-1" />
            <span className="font-semibold text-[#F2F5F2]">No Historical Snapshots Recorded Yet</span>
            <p className="text-xs text-[#9CAEA2] max-w-sm">
              ATmosIQ captures persistent telemetry snapshots into SQLite every 5 minutes when the overview feed is loaded. Historical trajectory will plot here as records accumulate.
            </p>
          </div>
        )}
      </div>

      {/* Honest data provenance note */}
      <div className="flex items-center gap-2 text-[12px] sm:text-[13px] text-[#9CAEA2]/90 pt-2.5 border-t border-emerald-950/60 leading-normal">
        <Info className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          {metricTab === 'history'
            ? 'Historical records are stored in the local SQLite database (table environmental_snapshots). The application does not synthesize artificial historical values to fill data gaps.'
            : 'Metrics represent real-time measurements across the 45 world cities (CAMS) and NASA FIRMS 24-hour thermal detections. Switch to "Historical Snapshots" to inspect persistent snapshot telemetry.'}
        </span>
      </div>
    </div>
  );
};

export default EnvironmentalTrends;
