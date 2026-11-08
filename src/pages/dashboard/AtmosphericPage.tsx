import React, { useState, useMemo } from 'react';
import { useDashboardContext } from '@/components/dashboard/DashboardLayout';
import { Wind, Search, AlertTriangle, ArrowUpDown, Info, RefreshCw, ShieldCheck } from 'lucide-react';
import type { AqPoint } from '@/types';

export const AtmosphericPage: React.FC = () => {
  const { air, refreshAll, setSelectedPlace } = useDashboardContext();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortField, setSortField] = useState<'usAqi' | 'pm25' | 'pm10'>('usAqi');
  const [sortAsc, setSortAsc] = useState(false);

  const points = air.data?.points ?? [];

  // Summary Metrics
  const validPoints = useMemo(() => points.filter((p) => p.usAqi != null), [points]);
  const unhealthyCount = useMemo(() => validPoints.filter((p) => (p.usAqi ?? 0) > 150).length, [validPoints]);
  const worstPoint = useMemo(() => {
    return [...validPoints].sort((a, b) => (b.usAqi ?? 0) - (a.usAqi ?? 0))[0] || null;
  }, [validPoints]);

  // Five Highest AQI Cities
  const topFive = useMemo(() => {
    return [...validPoints].sort((a, b) => (b.usAqi ?? 0) - (a.usAqi ?? 0)).slice(0, 5);
  }, [validPoints]);

  // Filtered & Sorted Full Table
  const filteredPoints = useMemo(() => {
    return validPoints
      .filter((p) => {
        const matchesSearch =
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.country.toLowerCase().includes(search.toLowerCase());
        const matchesCategory =
          filterCategory === 'all' || p.category.toLowerCase().replace(/\s+/g, '-') === filterCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        const valA = a[sortField] ?? 0;
        const valB = b[sortField] ?? 0;
        return sortAsc ? valA - valB : valB - valA;
      });
  }, [validPoints, search, filterCategory, sortField, sortAsc]);

  const handleSelectCity = (p: AqPoint) => {
    setSelectedPlace({
      name: `${p.name}, ${p.country}`,
      lat: p.lat,
      lon: p.lon,
      kind: 'air',
      details: [
        `US AQI: ${p.usAqi ?? 'N/A'} (${p.category})`,
        `PM2.5: ${p.pm25 ?? 'N/A'} µg/m³ · PM10: ${p.pm10 ?? 'N/A'} µg/m³`,
        'Model Source: Open-Meteo European CAMS',
      ],
    });
  };

  const getAqiBadgeColor = (aqi?: number | null) => {
    if (aqi == null) return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    if (aqi > 200) return 'bg-purple-950/70 text-purple-300 border-purple-800/60';
    if (aqi > 150) return 'bg-red-950/70 text-red-300 border-red-800/60';
    if (aqi > 100) return 'bg-amber-950/70 text-amber-300 border-amber-800/60';
    if (aqi > 50) return 'bg-yellow-950/70 text-yellow-300 border-yellow-800/60';
    return 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60';
  };

  return (
    <div className="space-y-8">
      {/* 1. Header Overview & Live KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[15px] sm:text-[16px] font-semibold text-[#A8BCAE]">
            <span>Peak Monitored AQI</span>
            <Wind className="w-5 h-5 text-red-400" />
          </div>
          <div className="text-[36px] sm:text-[40px] font-bold text-red-400 leading-none my-1">
            {worstPoint?.usAqi != null ? worstPoint.usAqi : '—'}
          </div>
          <p className="text-[14px] text-[#9CAEA2] truncate">
            {worstPoint ? `${worstPoint.name}, ${worstPoint.country}` : 'CAMS Observation stream'}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[15px] sm:text-[16px] font-semibold text-[#A8BCAE]">
            <span>Unhealthy Locations</span>
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-[36px] sm:text-[40px] font-bold text-amber-400 leading-none my-1">
            {unhealthyCount}
          </div>
          <p className="text-[14px] text-[#9CAEA2]">
            Locations with US AQI &gt; 150
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[15px] sm:text-[16px] font-semibold text-[#A8BCAE]">
            <span>Monitored Global Cities</span>
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-[36px] sm:text-[40px] font-bold text-[#F2F5F2] leading-none my-1">
            {validPoints.length}
          </div>
          <p className="text-[14px] text-[#9CAEA2]">
            Continuous CAMS dispersion network
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[15px] sm:text-[16px] font-semibold text-[#A8BCAE]">
            <span>Data Provenance</span>
            <Info className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="text-[24px] sm:text-[26px] font-bold text-cyan-300 leading-none my-1">
            Open-Meteo
          </div>
          <p className="text-[14px] text-[#9CAEA2]">
            Copernicus CAMS European model · Hourly
          </p>
        </div>
      </div>

      {/* 2. Top 5 Highest-AQI Cities Spotlight */}
      <div className="rounded-xl bg-[#101F18] border border-emerald-950 p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-3.5 border-b border-emerald-950/80">
          <div>
            <h3 className="text-[22px] sm:text-[24px] font-bold text-[#F2F5F2] tracking-tight">Top 5 Highest-Pollution Centers</h3>
            <p className="text-[14px] sm:text-[15px] text-[#9CAEA2] mt-1">
              Locations experiencing the most severe particulate burden in the current CAMS atmospheric cycle.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refreshAll()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#14251C] hover:bg-[#174C34] text-[14px] font-medium text-emerald-300 border border-emerald-800/60 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {topFive.map((p, idx) => (
            <div
              key={p.name}
              onClick={() => handleSelectCity(p)}
              className="p-4 rounded-xl bg-[#0D1914] border border-emerald-950/80 hover:border-emerald-700/60 transition-all cursor-pointer space-y-2 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#9CAEA2] font-semibold">#{idx + 1}</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase border ${getAqiBadgeColor(p.usAqi)}`}>
                    {p.category}
                  </span>
                </div>
                <h4 className="text-[18px] font-bold text-[#F2F5F2] mt-2 truncate" title={`${p.name}, ${p.country}`}>
                  {p.name}
                </h4>
                <p className="text-[13px] text-[#9CAEA2] truncate">{p.country}</p>
              </div>

              <div className="pt-2 border-t border-emerald-950/60 space-y-1">
                <div className="text-[28px] font-bold text-red-400 leading-tight">
                  {p.usAqi} <span className="text-[13px] font-normal text-[#9CAEA2]">AQI</span>
                </div>
                <div className="text-[13px] text-[#A8BCAE]">
                  PM2.5: <span className="text-[#F2F5F2] font-semibold">{p.pm25}</span> µg/m³
                </div>
                <div className="text-[13px] text-[#A8BCAE]">
                  PM10: <span className="text-[#F2F5F2] font-semibold">{p.pm10}</span> µg/m³
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Comprehensive Searchable & Filterable Table */}
      <div className="rounded-xl bg-[#101F18] border border-emerald-950 overflow-hidden shadow-sm">
        {/* Table Search & Controls */}
        <div className="p-5 border-b border-emerald-950/80 bg-[#0D1914] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h3 className="text-[20px] sm:text-[22px] font-bold text-[#F2F5F2]">All Monitored Global Locations</h3>
            <span className="text-[13px] px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-semibold">
              {filteredPoints.length} cities
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#9CAEA2] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search city or country..."
                className="pl-9 pr-3.5 py-2 rounded-lg bg-[#14251C] border border-emerald-900/60 text-[15px] text-[#F2F5F2] placeholder-[#9CAEA2] focus:outline-none focus:border-emerald-500 w-48 sm:w-60"
              />
            </div>

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3.5 py-2 rounded-lg bg-[#14251C] border border-emerald-900/60 text-[15px] text-[#F2F5F2] focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">All Conditions</option>
              <option value="good">Good (0-50)</option>
              <option value="moderate">Moderate (51-100)</option>
              <option value="unhealthy-for-sensitive-groups">Sensitive Groups (101-150)</option>
              <option value="unhealthy">Unhealthy (151-200)</option>
              <option value="very-unhealthy">Very Unhealthy (201-300)</option>
              <option value="hazardous">Hazardous (301+)</option>
            </select>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[15px]">
            <thead className="bg-[#0A1712] border-b border-emerald-950 text-[#A8BCAE] uppercase tracking-wider text-[13px]">
              <tr>
                <th className="py-3.5 px-5">Location</th>
                <th className="py-3.5 px-5">Coordinates</th>
                <th
                  className="py-3.5 px-5 cursor-pointer hover:text-emerald-300 transition-colors"
                  onClick={() => {
                    if (sortField === 'usAqi') setSortAsc(!sortAsc);
                    else { setSortField('usAqi'); setSortAsc(false); }
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>US AQI</span>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  className="py-3.5 px-5 cursor-pointer hover:text-emerald-300 transition-colors"
                  onClick={() => {
                    if (sortField === 'pm25') setSortAsc(!sortAsc);
                    else { setSortField('pm25'); setSortAsc(false); }
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>PM2.5</span>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  className="py-3.5 px-5 cursor-pointer hover:text-emerald-300 transition-colors"
                  onClick={() => {
                    if (sortField === 'pm10') setSortAsc(!sortAsc);
                    else { setSortField('pm10'); setSortAsc(false); }
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>PM10</span>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="py-3.5 px-5">Condition</th>
                <th className="py-3.5 px-5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-950/60">
              {filteredPoints.length > 0 ? (
                filteredPoints.map((p) => (
                  <tr key={`${p.name}-${p.country}`} className="hover:bg-[#14251C]/50 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-[#F2F5F2] text-[16px]">{p.name}</div>
                      <div className="text-[13px] text-[#9CAEA2]">{p.country}</div>
                    </td>
                    <td className="py-3.5 px-5 text-[14px] text-[#A8BCAE]">
                      {p.lat.toFixed(2)}°, {p.lon.toFixed(2)}°
                    </td>
                    <td className="py-3.5 px-5 font-bold text-[16px]">
                      <span className={p.usAqi && p.usAqi > 150 ? 'text-red-400 font-extrabold' : p.usAqi && p.usAqi > 100 ? 'text-amber-300' : 'text-emerald-400'}>
                        {p.usAqi ?? 'N/A'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-[#F2F5F2] text-[15px]">
                      {p.pm25 != null ? `${p.pm25} µg/m³` : '—'}
                    </td>
                    <td className="py-3.5 px-5 text-[#F2F5F2] text-[15px]">
                      {p.pm10 != null ? `${p.pm10} µg/m³` : '—'}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`px-2.5 py-1 rounded-md text-[12px] font-semibold uppercase tracking-wider border ${getAqiBadgeColor(p.usAqi)}`}>
                        {p.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <button
                        type="button"
                        onClick={() => handleSelectCity(p)}
                        className="px-3 py-1.5 rounded-lg bg-[#174C34]/60 hover:bg-[#174C34] text-emerald-300 hover:text-emerald-100 text-[14px] font-medium border border-emerald-700/60 transition-colors cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#9CAEA2] text-[15px]">
                    No locations match your search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scientific Clarification Notice */}
      <div className="flex items-start gap-2.5 p-4 rounded-xl bg-[#0D1914] border border-emerald-950/80 text-xs text-[#9CAEA2] leading-relaxed">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-[#F2F5F2]">Scientific Context: </span>
          Air quality values are provided via the Open-Meteo European Copernicus Atmosphere Monitoring Service (CAMS) reanalysis and forecast model. These values reflect modeled atmospheric dispersion and satellite data assimilation over designated metropolitan coordinates, rather than singular uncalibrated low-cost IoT sensors.
        </div>
      </div>
    </div>
  );
};

export default AtmosphericPage;

