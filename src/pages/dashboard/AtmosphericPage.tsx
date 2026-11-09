import React, { useState, useMemo } from 'react';
import { useDashboardContext } from '@/components/dashboard/DashboardLayout';
import { Wind, Search, AlertTriangle, ArrowUpDown, ShieldCheck } from 'lucide-react';
import type { SelectedPlace } from '@/types';

export const AtmosphericPage: React.FC = () => {
  const { air, setSelectedPlace } = useDashboardContext();

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortField, setSortField] = useState<'name' | 'usAqi' | 'pm25' | 'pm10'>('usAqi');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const getAqiBadgeColor = (aqi?: number | null) => {
    if (aqi == null) return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    if (aqi > 200) return 'bg-purple-950/80 text-purple-300 border-purple-800/70';
    if (aqi > 150) return 'bg-red-950/80 text-red-300 border-red-800/70';
    if (aqi > 100) return 'bg-amber-950/80 text-amber-300 border-amber-800/70';
    if (aqi > 50) return 'bg-yellow-950/80 text-yellow-300 border-yellow-800/70';
    return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/70';
  };

  // Filtered and sorted points from Open-Meteo European CAMS
  const filteredPoints = useMemo(() => {
    if (!air.data?.points) return [];
    let list = [...air.data.points];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.country.toLowerCase().includes(q));
    }

    if (filterCategory !== 'all') {
      list = list.filter((p) => {
        const cat = (p.category || '').toLowerCase().replace(/\s+/g, '-');
        return cat.includes(filterCategory.toLowerCase());
      });
    }

    list.sort((a, b) => {
      let valA: string | number = 0;
      let valB: string | number = 0;
      if (sortField === 'name') {
        valA = a.name;
        valB = b.name;
        return sortAsc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
      } else if (sortField === 'usAqi') {
        valA = a.usAqi ?? -1;
        valB = b.usAqi ?? -1;
      } else if (sortField === 'pm25') {
        valA = a.pm25 ?? -1;
        valB = b.pm25 ?? -1;
      } else if (sortField === 'pm10') {
        valA = a.pm10 ?? -1;
        valB = b.pm10 ?? -1;
      }
      return sortAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });

    return list;
  }, [air.data?.points, search, filterCategory, sortField, sortAsc]);

  const topFive = useMemo(() => {
    if (!air.data?.points) return [];
    return [...air.data.points]
      .filter((p) => p.usAqi != null)
      .sort((a, b) => (b.usAqi ?? 0) - (a.usAqi ?? 0))
      .slice(0, 5);
  }, [air.data?.points]);

  const stats = useMemo(() => {
    const pts = air.data?.points || [];
    const unhealthy = pts.filter((p) => (p.usAqi ?? 0) > 150).length;
    const moderate = pts.filter((p) => (p.usAqi ?? 0) > 50 && (p.usAqi ?? 0) <= 150).length;
    const good = pts.filter((p) => (p.usAqi ?? 0) <= 50).length;
    return { total: pts.length, unhealthy, moderate, good };
  }, [air.data?.points]);

  const handleSelectCity = (city: typeof topFive[0]) => {
    const selected: SelectedPlace = {
      name: `${city.name}, India`,
      lat: city.lat,
      lon: city.lon,
      kind: 'air',
      details: [
        `US AQI: ${city.usAqi ?? 'n/a'} (${city.category})`,
        `PM2.5: ${city.pm25 ?? 'n/a'} µg/m³ · PM10: ${city.pm10 ?? 'n/a'} µg/m³`,
        `Source: Copernicus CAMS model extraction`,
      ],
    };
    setSelectedPlace(selected);
  };

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      {/* 1. Header & Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 min-w-0">
        <div className="p-4 sm:p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-1 min-w-0">
          <span className="text-xs sm:text-[13px] text-[#A8BCAE] uppercase font-semibold block">Total Stations</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[#F2F5F2]">{stats.total}</div>
          <p className="text-xs sm:text-[13px] text-[#9CAEA2]">All 28 States &amp; 8 UTs</p>
        </div>

        <div className="p-4 sm:p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-1 min-w-0">
          <span className="text-xs sm:text-[13px] text-red-300 uppercase font-semibold block">Unhealthy (&gt;150 AQI)</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-red-400">{stats.unhealthy}</div>
          <p className="text-xs sm:text-[13px] text-[#9CAEA2]">Requires public advisory</p>
        </div>

        <div className="p-4 sm:p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-1 min-w-0">
          <span className="text-xs sm:text-[13px] text-amber-300 uppercase font-semibold block">Moderate (51–150 AQI)</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-amber-400">{stats.moderate}</div>
          <p className="text-xs sm:text-[13px] text-[#9CAEA2]">Acceptable air quality</p>
        </div>

        <div className="p-4 sm:p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-1 min-w-0">
          <span className="text-xs sm:text-[13px] text-emerald-400 uppercase font-semibold block">Model Feed</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-emerald-300 truncate">Copernicus CAMS</div>
          <p className="text-xs sm:text-[13px] text-[#9CAEA2]">Hourly assimilation stream</p>
        </div>
      </div>

      {/* 2. Top 5 Highest-AQI Cities Spotlight */}
      <div className="rounded-xl bg-[#101F18] border border-emerald-950 p-4 sm:p-6 shadow-sm space-y-4 min-w-0">
        <div className="pb-3 border-b border-emerald-950/80">
          <div className="flex items-center gap-2 mb-1">
            <Wind className="w-5 h-5 text-cyan-400 shrink-0" />
            <h3 className="text-lg sm:text-xl font-bold font-serif text-[#F2F5F2] tracking-tight">
              Top 5 Highest-Pollution Centers
            </h3>
          </div>
          <p className="text-sm sm:text-[15px] text-[#CBDAD0] leading-relaxed">
            Indian locations experiencing the highest particulate concentrations in the current CAMS atmospheric cycle.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 min-w-0">
          {topFive.map((p, idx) => (
            <div
              key={p.name}
              onClick={() => handleSelectCity(p)}
              className="p-3.5 rounded-xl bg-[#0D1914] border border-emerald-950/80 hover:border-emerald-700/60 transition-all cursor-pointer space-y-2.5 flex flex-col justify-between min-w-0"
            >
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-mono text-[#9CAEA2] font-semibold">#{idx + 1}</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase border ${getAqiBadgeColor(p.usAqi)}`}>
                    {p.category}
                  </span>
                </div>
                <h4 className="text-[15px] font-bold text-[#F2F5F2] mt-1.5 truncate" title={`${p.name}, ${p.country}`}>
                  {p.name}
                </h4>
                <p className="text-xs sm:text-[13px] text-[#9CAEA2] truncate">{p.country}</p>
              </div>

              <div className="pt-2 border-t border-emerald-950/60 space-y-1">
                <div className="text-2xl font-bold font-mono text-red-400 leading-tight">
                  {p.usAqi} <span className="text-xs font-medium text-[#9CAEA2]">AQI</span>
                </div>
                <div className="text-xs sm:text-[13px] text-[#A8BCAE] flex justify-between">
                  <span>PM2.5:</span>
                  <span className="text-[#F2F5F2] font-semibold font-mono">{p.pm25} µg/m³</span>
                </div>
                <div className="text-xs sm:text-[13px] text-[#A8BCAE] flex justify-between">
                  <span>PM10:</span>
                  <span className="text-[#F2F5F2] font-semibold font-mono">{p.pm10} µg/m³</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Comprehensive Searchable & Filterable Table */}
      <div className="rounded-xl bg-[#101F18] border border-emerald-950 overflow-hidden shadow-sm min-w-0">
        {/* Table Search & Controls */}
        <div className="p-4 sm:p-5 border-b border-emerald-950/80 bg-[#0D1914] flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-base sm:text-lg font-bold font-serif text-[#F2F5F2] truncate">
              All Monitored Indian Observatories
            </h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-semibold shrink-0">
              {filteredPoints.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            {/* Search Input */}
            <div className="relative min-w-0 flex-1 sm:flex-initial">
              <Search className="w-4 h-4 text-[#9CAEA2] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search location..."
                className="pl-9 pr-3 py-1.5 rounded-lg bg-[#14251C] border border-emerald-900/60 text-sm text-[#F2F5F2] placeholder-[#9CAEA2] focus:outline-none focus:border-emerald-500 w-full sm:w-52"
              />
            </div>

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#14251C] border border-emerald-900/60 text-sm text-[#F2F5F2] focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">All Conditions</option>
              <option value="good">Good (0-50)</option>
              <option value="moderate">Moderate (51-100)</option>
              <option value="unhealthy-for-sensitive-groups">Sensitive (101-150)</option>
              <option value="unhealthy">Unhealthy (151-200)</option>
              <option value="very-unhealthy">Very Unhealthy (201-300)</option>
              <option value="hazardous">Hazardous (301+)</option>
            </select>
          </div>
        </div>

        {/* Table Body with Responsive Horizontal Scroll */}
        <div className="overflow-x-auto min-w-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#0A1712] border-b border-emerald-950 text-[#A8BCAE] uppercase tracking-wider text-xs">
              <tr>
                <th className="py-3 px-4 font-semibold">Location</th>
                <th className="py-3 px-4 font-semibold">Coordinates</th>
                <th
                  className="py-3 px-4 cursor-pointer hover:text-emerald-300 transition-colors font-semibold"
                  onClick={() => {
                    if (sortField === 'usAqi') setSortAsc(!sortAsc);
                    else { setSortField('usAqi'); setSortAsc(false); }
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>US AQI</span>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  className="py-3 px-4 cursor-pointer hover:text-emerald-300 transition-colors font-semibold"
                  onClick={() => {
                    if (sortField === 'pm25') setSortAsc(!sortAsc);
                    else { setSortField('pm25'); setSortAsc(false); }
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>PM2.5</span>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="py-3 px-4 font-semibold">PM10</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-950/60 text-[#CBDAD0]">
              {filteredPoints.length > 0 ? (
                filteredPoints.map((p) => (
                  <tr key={p.name} className="hover:bg-[#14251C]/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-[#F2F5F2] text-[15px]">{p.name}</td>
                    <td className="py-3 px-4 font-mono text-xs sm:text-[13px] text-[#9CAEA2]">
                      {p.lat.toFixed(2)}°N, {p.lon.toFixed(2)}°E
                    </td>
                    <td className="py-3 px-4 font-bold font-mono text-[15px]">
                      <span className={p.usAqi != null && p.usAqi > 150 ? 'text-red-400' : p.usAqi != null && p.usAqi > 100 ? 'text-amber-400' : 'text-emerald-400'}>
                        {p.usAqi ?? '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[14px]">{p.pm25 != null ? `${p.pm25} µg/m³` : '—'}</td>
                    <td className="py-3 px-4 font-mono text-[14px]">{p.pm10 != null ? `${p.pm10} µg/m³` : '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase border ${getAqiBadgeColor(p.usAqi)}`}>
                        {p.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSelectCity(p)}
                        className="text-xs sm:text-[13px] text-emerald-400 hover:text-emerald-300 font-semibold hover:underline cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#9CAEA2] text-sm">
                    No observatories match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AtmosphericPage;
