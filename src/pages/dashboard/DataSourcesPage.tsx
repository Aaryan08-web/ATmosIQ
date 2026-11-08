import React from 'react';
import { useDashboardContext } from '@/components/dashboard/DashboardLayout';
import { Database, Satellite, Wind, TreeDeciduous, Sparkles, CheckCircle2, AlertCircle, Clock, ExternalLink, ShieldCheck } from 'lucide-react';

export const DataSourcesPage: React.FC = () => {
  const { fires, air, forest, overview } = useDashboardContext();

  const SOURCES = [
    {
      id: 'firms',
      name: 'NASA FIRMS (Fire Information for Resource Management System)',
      icon: Satellite,
      badge: fires.data?.live ? 'Live Sensor Pass' : 'Sample Telemetry Pass',
      status: fires.data?.live ? 'live' : 'sample',
      description:
        'Continuous near-real-time (NRT) satellite observation capturing active thermal anomalies and fire radiative power (FRP) across sovereign Indian territory and agricultural zones.',
      specs: [
        { label: 'Sensor Resolution', value: '375m Spatial Resolution (VIIRS)' },
        { label: 'Satellites', value: 'Suomi-NPP & NOAA-20 / NOAA-21' },
        { label: 'Temporal Cadence', value: 'Every 12 to 24 hours per orbital node' },
        { label: 'Primary Metrics', value: 'Fire Radiative Power (MW), Detection Confidence, Day/Night' },
        { label: 'Live Ingestion Count', value: `${fires.data?.points?.length || 0} active detections in past 24h` },
      ],
      attribution: 'NASA Earth Science Data Systems / LANCE FIRMS',
      endpoint: '/api/v1/fires',
      link: 'https://firms.modaps.eosdis.nasa.gov/',
    },
    {
      id: 'open-meteo',
      name: 'Open-Meteo & European CAMS (Copernicus Atmosphere Monitoring Service)',
      icon: Wind,
      badge: air.data ? 'Live Model Stream' : 'Unavailable',
      status: air.data ? 'live' : 'unavailable',
      description:
        'Comprehensive multi-pollutant atmospheric chemistry modeling combining satellite assimilation, European reanalysis, and surface observation vectors across all 28 Indian States and 8 Union Territories.',
      specs: [
        { label: 'Atmospheric Model', value: 'CAMS European Global Atmospheric Composition' },
        { label: 'Pollutants Tracked', value: 'PM2.5, PM10, Nitrogen Dioxide (NO2), Ozone (O3), Carbon Monoxide (CO), Sulfur Dioxide (SO2), US AQI' },
        { label: 'Temporal Cadence', value: 'Hourly synchronous reanalysis & forecasts' },
        { label: 'Spatial Coverage', value: `${air.data?.points?.length || 58} CAMS Grid Extractions across All 28 Indian States & 8 UTs` },
        { label: 'Model Methodology', value: 'Copernicus Atmospheric Reanalysis & Satellite Assimilation (Modelled Estimates, Not Ground CAAQMS)' },
        { label: 'Last Model Run', value: air.data?.fetchedAt ? new Date(air.data.fetchedAt).toLocaleTimeString() : 'Hourly cycle' },
      ],
      attribution: 'Copernicus Atmospheric Monitoring Service & Open-Meteo',
      endpoint: '/api/v1/air-quality',
      link: 'https://open-meteo.com/en/docs/air-quality-api',
    },
    {
      id: 'gfw',
      name: 'Global Forest Watch Data API & Reference Baseline',
      icon: TreeDeciduous,
      badge: forest.data?.liveAlerts && forest.data.liveAlerts.length > 0
        ? 'Live Ingestion Active'
        : forest.data?.syncStatus?.status === 'unauthorized'
        ? 'API Key Unauthorized (401/403)'
        : forest.data?.syncStatus?.status === 'failed'
        ? 'Sync Failed'
        : 'Reference Baseline Active',
      status: forest.data?.liveAlerts && forest.data.liveAlerts.length > 0
        ? 'live'
        : forest.data?.syncStatus?.status === 'unauthorized'
        ? 'unavailable'
        : 'reference',
      description:
        'Official integration with the Global Forest Watch Data API delivering near-real-time integrated deforestation alerts for Indian forest AOIs (Western Ghats, Sundarbans, Karbi Anglong, Satpura-Maikal). A curated baseline catalog of Indian protected biomes is preserved as permanent reference telemetry.',
      specs: [
        { label: 'API Endpoint', value: 'https://data-api.globalforestwatch.org' },
        { label: 'Integrated Dataset', value: 'gfw_integrated_alerts (latest version)' },
        { label: 'Authentication Header', value: 'x-api-key: [SECURE_IN_ENV]' },
        { label: 'Ingestion Architecture', value: 'Background SQLite pipeline with deduplication' },
        {
          label: 'Sync Status',
          value: forest.data?.syncStatus?.status
            ? `Status: ${forest.data.syncStatus.status.toUpperCase()}${forest.data.syncStatus.error_message ? ` (${forest.data.syncStatus.error_message})` : ''}`
            : 'Idle / Polling Standby',
        },
        {
          label: 'Last Synchronized',
          value: forest.data?.syncStatus?.last_success_at
            ? new Date(forest.data.syncStatus.last_success_at).toLocaleString()
            : 'Pending API Key Grant',
        },
        {
          label: 'Live Alert Ingestion',
          value: `${forest.data?.liveAlerts?.length || 0} alerts stored in database`,
        },
        {
          label: 'Curated Indian Biomes',
          value: `${forest.data?.points?.length || 12} protected forest landscapes`,
        },
      ],
      attribution: 'World Resources Institute / Global Forest Watch & UMD GLAD Lab',
      endpoint: '/api/v1/deforestation · /api/v1/gfw/alerts · /api/v1/gfw/sync',
      link: 'https://data-api.globalforestwatch.org/',
    },
    {
      id: 'gemini',
      name: 'Google Gemini & Rule-Based Synthesis Engine',
      icon: Sparkles,
      badge: 'Neural Analysis',
      status: 'live',
      description:
        'Multivariate environmental reasoning engine synthesizing spatial proximity vectors, active particulate dispersion, and ecological threat dynamics into actionable mitigation briefings.',
      specs: [
        { label: 'Foundation Model', value: 'Gemini Foundation Models (or deterministic offline rule-based fallback)' },
        { label: 'Input Grounding', value: 'Strictly bounded to active FIRMS, CAMS, and GFW vectors within radius' },
        { label: 'Analysis Output', value: 'Situation assessment, potential impacts, and recommended mitigations' },
        { label: 'Rate Control', value: '8 syntheses per minute rate-limited with fallback resilience' },
        { label: 'Safety Guarantee', value: 'Zero fabricated weather predictions or historical dates' },
      ],
      attribution: 'Google DeepMind & ATmosIQ Spatial Intelligence Core',
      endpoint: '/api/v1/ai/summary',
      link: 'https://deepmind.google/technologies/gemini/',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live Ingestion Active
          </span>
        );
      case 'reference':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold uppercase bg-purple-950/80 text-purple-300 border border-purple-800/60">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            Curated Reference Dataset
          </span>
        );
      case 'sample':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold uppercase bg-amber-950/80 text-amber-300 border border-amber-800/60">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Sample Ingestion Pass
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold uppercase bg-red-950/80 text-red-300 border border-red-800/60">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            Temporarily Unavailable
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Header Overview */}
      <div className="p-6 sm:p-7 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-2.5">
        <div className="flex items-center gap-2.5">
          <Database className="w-6 h-6 text-emerald-400" />
          <h2 className="text-[24px] sm:text-[28px] font-bold text-[#F2F5F2] tracking-tight">Environmental Telemetry &amp; Provenance Infrastructure</h2>
        </div>
        <p className="text-[15px] sm:text-[16px] text-[#9CAEA2] max-w-3xl leading-relaxed">
          ATmosIQ aggregates and normalizes multi-sensor planetary observations from authenticated space agencies and meteorological centers. Transparency regarding sensor resolution, temporal cadence, and reference classification is maintained across all layers.
        </p>
      </div>

      {/* 2. Detailed Data Source Cards */}
      <div className="space-y-6">
        {SOURCES.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.id}
              className="p-6 sm:p-7 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-5"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-emerald-950/80">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-[#174C34]/50 border border-emerald-600/60 text-emerald-400 flex items-center justify-center shrink-0 shadow-sm">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-[20px] font-bold text-[#F2F5F2]">{s.name}</h3>
                    <p className="text-[14px] text-[#9CAEA2] mt-0.5">{s.attribution}</p>
                  </div>
                </div>

                <div className="shrink-0">{getStatusBadge(s.status)}</div>
              </div>

              {/* Description */}
              <p className="text-[15px] sm:text-[16px] text-[#CBDAD0] leading-relaxed">
                {s.description}
              </p>

              {/* Technical Specifications Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
                {s.specs.map((spec) => (
                  <div
                    key={spec.label}
                    className="p-3.5 rounded-lg bg-[#0D1914] border border-emerald-950/80 space-y-1"
                  >
                    <span className="text-[12px] text-[#9CAEA2] uppercase font-semibold block">{spec.label}</span>
                    <span className="text-[14px] text-[#F2F5F2] font-semibold block">{spec.value}</span>
                  </div>
                ))}
              </div>

              {/* Footer link & endpoint */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-emerald-950/80 text-[14px] text-[#9CAEA2]">
                <div className="flex items-center gap-2">
                  <span>Internal API:</span>
                  <code className="px-2 py-0.5 rounded bg-black/40 text-emerald-300 font-semibold border border-emerald-900/50">
                    {s.endpoint}
                  </code>
                </div>

                <a
                  href={s.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1.5 font-medium"
                >
                  <span>Official Provider Documentation</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. India Forest Coverage & Surveillance Grid */}
      <div className="p-6 sm:p-7 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-emerald-950/80">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#174C34]/50 border border-emerald-600/60 text-emerald-400 flex items-center justify-center shrink-0 shadow-sm">
              <TreeDeciduous className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-[20px] font-bold text-[#F2F5F2]">National Forest Surveillance &amp; Spatial Coverage Grid</h3>
              <p className="text-[14px] text-[#9CAEA2] mt-0.5">
                Active AOI bounds, surveillance status, and regional coverage across India's 7 ecological zones
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-md text-[12px] font-mono font-bold uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
              12 Active AOIs Monitored
            </span>
          </div>
        </div>

        {/* Coverage Disclaimer Alert */}
        <div className="p-4 rounded-lg bg-[#0D1914] border border-amber-900/60 text-amber-200/90 text-[14px] leading-relaxed flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-300 font-semibold">Surveillance Coverage &amp; Data Honesty Notice: </strong>
            Near-real-time satellite surveillance is concentrated over 12 defined high-risk biodiversity and tiger corridors. Areas outside these bounds are unmonitored by NRT sensors; absence of alerts in unmonitored zones reflects lack of active sensor sampling, NOT absence of deforestation. Full national canopy assessments rely on the biennial Forest Survey of India (ISFR) census.
          </div>
        </div>

        {/* Table of Monitored vs Unmonitored Zones */}
        <div className="overflow-x-auto rounded-lg border border-emerald-950/80">
          <table className="w-full text-left border-collapse text-[14px]">
            <thead>
              <tr className="bg-[#0D1914] border-b border-emerald-950 text-[#9CAEA2] text-[13px] uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold">Ecological Zone</th>
                <th className="py-3 px-4 font-semibold">Corridor Name</th>
                <th className="py-3 px-4 font-semibold">State / Region</th>
                <th className="py-3 px-4 font-semibold">Surveillance Type</th>
                <th className="py-3 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-950/60 text-[#CBDAD0]">
              {[
                { zone: 'Western Ghats', name: 'Nilgiri & Wayanad Corridor', state: 'Kerala / Karnataka / TN', type: 'GFW Integrated NRT (40x40km)', status: 'Active' },
                { zone: 'Western Ghats', name: 'Koyna-Mahabaleshwar Corridor', state: 'Maharashtra', type: 'GFW Integrated NRT (40x40km)', status: 'Active' },
                { zone: 'Western Ghats', name: 'Anamalai & Periyar Corridor', state: 'Kerala / Tamil Nadu', type: 'GFW Integrated NRT (40x40km)', status: 'Active' },
                { zone: 'Sundarbans', name: 'Sundarbans Mangrove Delta', state: 'West Bengal', type: 'GFW Integrated NRT (40x40km)', status: 'Active' },
                { zone: 'Northeast India', name: 'Karbi Anglong & Kaziranga Foothills', state: 'Assam', type: 'GFW Integrated NRT (40x40km)', status: 'Active' },
                { zone: 'Northeast India', name: 'Dampa & Western Mizoram Hills', state: 'Mizoram', type: 'GFW Integrated NRT (40x40km)', status: 'Active' },
                { zone: 'Central India', name: 'Satpura-Maikal Kanha Corridor', state: 'Madhya Pradesh', type: 'GFW Integrated NRT (40x40km)', status: 'Active' },
                { zone: 'Central India', name: 'Bastar & Dandakaranya Dense Forest', state: 'Chhattisgarh', type: 'GFW Integrated NRT (40x40km)', status: 'Active' },
                { zone: 'Eastern India', name: 'Saranda Dense Sal Forest Belt', state: 'Jharkhand / Odisha', type: 'GFW Integrated NRT (40x40km)', status: 'Active' },
                { zone: 'Eastern India', name: 'Similipal Biosphere Reserve Core', state: 'Odisha', type: 'GFW Integrated NRT (40x40km)', status: 'Active' },
                { zone: 'Himalayan Belt', name: 'Rajaji-Corbett Shivalik Foothills', state: 'Uttarakhand', type: 'GFW Integrated NRT (40x40km)', status: 'Active' },
                { zone: 'Island Ecosystem', name: 'Great Nicobar Biosphere Reserve', state: 'Andaman & Nicobar', type: 'GFW Integrated NRT (40x40km)', status: 'Active' },
                { zone: 'All Other Zones', name: 'Inter-corridor rural/urban forestry tracts', state: 'Pan-India', type: 'Biennial FSI Census Baselines', status: 'Unmonitored in NRT' },
              ].map((row, idx) => (
                <tr key={idx} className="hover:bg-[#14251C]/60 transition-colors">
                  <td className="py-3 px-4 font-semibold text-[#F2F5F2]">{row.zone}</td>
                  <td className="py-3 px-4">{row.name}</td>
                  <td className="py-3 px-4 text-[#9CAEA2]">{row.state}</td>
                  <td className="py-3 px-4 font-mono text-[13px]">{row.type}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
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

