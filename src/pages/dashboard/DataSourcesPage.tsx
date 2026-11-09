import React from 'react';
import { useDashboardContext } from '@/components/dashboard/DashboardLayout';
import { Database, Satellite, Wind, TreeDeciduous, Sparkles, ExternalLink, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

export const DataSourcesPage: React.FC = () => {
  const { fires, air, forest } = useDashboardContext();

  const SOURCES = [
    {
      id: 'firms',
      name: 'NASA FIRMS',
      fullName: 'Fire Information for Resource Management System',
      icon: Satellite,
      badge: fires.data?.live ? 'Live VIIRS Pass' : 'Sample Feed',
      status: fires.data?.live ? 'live' : 'sample',
      provides: 'Satellite thermal anomaly observations and fire radiative power (FRP) across India.',
      cadence: 'Every 12 to 24 hours per orbital pass',
      resolution: '375m Spatial Resolution (VIIRS)',
      lastUpdate: fires.data?.fetchedAt ? new Date(fires.data.fetchedAt).toLocaleTimeString() : 'Recent pass',
      attribution: 'NASA Earth Science Data Systems / LANCE FIRMS',
      link: 'https://firms.modaps.eosdis.nasa.gov/',
    },
    {
      id: 'cams',
      name: 'Copernicus CAMS & Open-Meteo',
      fullName: 'European Atmosphere Monitoring Service',
      icon: Wind,
      badge: air.data ? 'Active Stream' : 'Unavailable',
      status: air.data ? 'live' : 'unavailable',
      provides: 'Modelled atmospheric composition and air-quality estimates (AQI, PM2.5, PM10, NO2, SO2, CO, O3) across all 28 Indian States and 8 Union Territories.',
      cadence: 'Hourly synchronous reanalysis & forecasts',
      resolution: 'Regional European atmospheric chemistry grid',
      lastUpdate: air.data?.fetchedAt ? new Date(air.data.fetchedAt).toLocaleTimeString() : 'Hourly cycle',
      attribution: 'Copernicus Atmosphere Monitoring Service & Open-Meteo',
      link: 'https://open-meteo.com/en/docs/air-quality-api',
    },
    {
      id: 'gfw',
      name: 'Global Forest Watch',
      fullName: 'World Resources Institute Canopy Surveillance',
      icon: TreeDeciduous,
      badge: forest.data?.liveAlerts && forest.data.liveAlerts.length > 0
        ? 'Live Ingestion Active'
        : 'Reference Baseline Active',
      status: forest.data?.liveAlerts && forest.data.liveAlerts.length > 0
        ? 'live'
        : 'reference',
      provides: 'Near-real-time integrated forest disturbance alerts and curated ecological baseline corridors across India.',
      cadence: 'Weekly satellite composite updates',
      resolution: '30m GLAD Landsat / Sentinel-2 pixel disturbance',
      lastUpdate: forest.data?.syncStatus?.last_success_at
        ? new Date(forest.data.syncStatus.last_success_at).toLocaleDateString()
        : 'Active surveillance',
      attribution: 'World Resources Institute / Global Forest Watch',
      link: 'https://www.globalforestwatch.org/',
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      fullName: 'Environmental Intelligence Synthesis Core',
      icon: Sparkles,
      badge: 'Neural Analysis',
      status: 'live',
      provides: 'Automated synthesis engine generating situational assessments, risk indicators, and recommendations grounded strictly in verified sensor telemetry.',
      cadence: 'On-demand generation with rule-based fallback resilience',
      resolution: 'Coordinate-bounded spatial reasoning',
      lastUpdate: 'Real-time generation',
      attribution: 'Google DeepMind & ATmosIQ Spatial Intelligence Core',
      link: 'https://deepmind.google/technologies/gemini/',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Stream
          </span>
        );
      case 'reference':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold uppercase bg-purple-950/80 text-purple-300 border border-purple-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            Curated Reference
          </span>
        );
      case 'sample':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold uppercase bg-amber-950/80 text-amber-300 border border-amber-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Sample Stream
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold uppercase bg-red-950/80 text-red-300 border border-red-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            Unavailable
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      {/* 1. Header Overview */}
      <div className="p-4 sm:p-6 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-2 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Database className="w-5 h-5 text-emerald-400 shrink-0" />
          <h2 className="text-lg sm:text-2xl font-bold font-serif text-[#F2F5F2] tracking-tight">
            Environmental Telemetry Sources
          </h2>
        </div>
        <p className="text-sm sm:text-[15px] text-[#CBDAD0] max-w-3xl leading-relaxed">
          ATmosIQ aggregates and normalizes multi-sensor planetary observations from authenticated space agencies and meteorological centers. Real-time satellite data and modelled forecasts are distinguished across all layers.
        </p>
      </div>

      {/* 2. Simplified Data Source Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 min-w-0">
        {SOURCES.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.id}
              className="p-4 sm:p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm flex flex-col justify-between space-y-4 min-w-0"
            >
              <div className="space-y-3 min-w-0">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-emerald-950/80 min-w-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-[#174C34]/50 border border-emerald-600/60 text-emerald-400 flex items-center justify-center shrink-0 shadow-sm">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-lg font-bold font-serif text-[#F2F5F2] truncate">{s.name}</h3>
                      <p className="text-xs sm:text-[13px] text-[#9CAEA2] truncate">{s.fullName}</p>
                    </div>
                  </div>

                  <div className="shrink-0">{getStatusBadge(s.status)}</div>
                </div>

                {/* What it provides */}
                <div className="space-y-1">
                  <span className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400">
                    Information Provided
                  </span>
                  <p className="text-sm sm:text-[15px] text-[#CBDAD0] leading-relaxed">
                    {s.provides}
                  </p>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 pt-1 text-xs sm:text-[13px]">
                  <div className="p-2.5 rounded-lg bg-[#0D1914] border border-emerald-950/80">
                    <span className="text-xs text-[#A8BCAE] uppercase block font-semibold">Update Cycle</span>
                    <span className="text-xs sm:text-sm text-[#F2F5F2] font-medium block truncate mt-0.5">{s.cadence}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#0D1914] border border-emerald-950/80">
                    <span className="text-xs text-[#A8BCAE] uppercase block font-semibold">Sensor Resolution</span>
                    <span className="text-xs sm:text-sm text-[#F2F5F2] font-medium block truncate mt-0.5">{s.resolution}</span>
                  </div>
                </div>
              </div>

              {/* Footer link & attribution */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-emerald-950/80 text-xs sm:text-[13px] text-[#9CAEA2]">
                <span className="truncate">{s.attribution}</span>
                <a
                  href={s.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 font-semibold shrink-0 cursor-pointer"
                >
                  <span>Provider Info</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. National Forest Surveillance & Spatial Coverage Grid */}
      <div className="p-4 sm:p-6 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-950/80 min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-[#174C34]/50 border border-emerald-600/60 text-emerald-400 flex items-center justify-center shrink-0 shadow-sm">
              <TreeDeciduous className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-bold font-serif text-[#F2F5F2] truncate">
                National Forest Surveillance Grid
              </h3>
              <p className="text-xs sm:text-[13px] text-[#9CAEA2] truncate">
                Active AOI surveillance bounds across Indian ecological zones
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 shrink-0">
            12 Active Corridors
          </span>
        </div>

        {/* Table of Monitored vs Unmonitored Zones with Clean Horizontal Scroll */}
        <div className="overflow-x-auto rounded-lg border border-emerald-950/80 min-w-0">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#0D1914] border-b border-emerald-950 text-[#A8BCAE] text-xs uppercase tracking-wider">
                <th className="py-3 px-3.5 sm:px-4 font-semibold">Ecological Zone</th>
                <th className="py-3 px-3.5 sm:px-4 font-semibold">Corridor Name</th>
                <th className="py-3 px-3.5 sm:px-4 font-semibold">State / Region</th>
                <th className="py-3 px-3.5 sm:px-4 font-semibold">Surveillance Type</th>
                <th className="py-3 px-3.5 sm:px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-950/60 text-[#CBDAD0]">
              {[
                { zone: 'Western Ghats', name: 'Nilgiri & Wayanad Corridor', state: 'Kerala / Karnataka / TN', type: 'GFW NRT (~40x40km)', status: 'Active' },
                { zone: 'Western Ghats', name: 'Koyna-Mahabaleshwar Corridor', state: 'Maharashtra', type: 'GFW NRT (~40x40km)', status: 'Active' },
                { zone: 'Western Ghats', name: 'Anamalai & Periyar Corridor', state: 'Kerala / Tamil Nadu', type: 'GFW NRT (~40x40km)', status: 'Active' },
                { zone: 'Sundarbans', name: 'Sundarbans Mangrove Delta', state: 'West Bengal', type: 'GFW NRT (~40x40km)', status: 'Active' },
                { zone: 'Northeast India', name: 'Karbi Anglong & Kaziranga Foothills', state: 'Assam', type: 'GFW NRT (~40x40km)', status: 'Active' },
                { zone: 'Northeast India', name: 'Dampa & Western Mizoram Hills', state: 'Mizoram', type: 'GFW NRT (~40x40km)', status: 'Active' },
                { zone: 'Central India', name: 'Satpura-Maikal Kanha Corridor', state: 'Madhya Pradesh', type: 'GFW NRT (~40x40km)', status: 'Active' },
                { zone: 'Central India', name: 'Bastar & Dandakaranya Dense Forest', state: 'Chhattisgarh', type: 'GFW NRT (~40x40km)', status: 'Active' },
                { zone: 'Eastern India', name: 'Saranda Dense Sal Forest Belt', state: 'Jharkhand / Odisha', type: 'GFW NRT (~40x40km)', status: 'Active' },
                { zone: 'Eastern India', name: 'Similipal Biosphere Reserve Core', state: 'Odisha', type: 'GFW NRT (~40x40km)', status: 'Active' },
                { zone: 'Himalayan Belt', name: 'Rajaji-Corbett Shivalik Foothills', state: 'Uttarakhand', type: 'GFW NRT (~40x40km)', status: 'Active' },
                { zone: 'Island Ecosystem', name: 'Great Nicobar Biosphere Reserve', state: 'Andaman & Nicobar', type: 'GFW NRT (~40x40km)', status: 'Active' },
                { zone: 'All Other Zones', name: 'Inter-corridor rural/urban forestry tracts', state: 'Pan-India', type: 'Biennial FSI Census Baselines', status: 'Census' },
              ].map((row, idx) => (
                <tr key={idx} className="hover:bg-[#14251C]/60 transition-colors">
                  <td className="py-3 px-3.5 sm:px-4 font-semibold text-[#F2F5F2] text-[15px]">{row.zone}</td>
                  <td className="py-3 px-3.5 sm:px-4 text-sm">{row.name}</td>
                  <td className="py-3 px-3.5 sm:px-4 text-[#A8BCAE] text-xs sm:text-sm">{row.state}</td>
                  <td className="py-3 px-3.5 sm:px-4 font-mono text-xs sm:text-[13px] text-[#A8BCAE]">{row.type}</td>
                  <td className="py-3 px-3.5 sm:px-4">
                    <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase ${
                      row.status === 'Active'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-[#1a231f] text-[#8ea395] border border-emerald-950'
                    }`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DataSourcesPage;
