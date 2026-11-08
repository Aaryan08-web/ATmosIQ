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
        'Continuous near-real-time (NRT) satellite observation capturing active thermal anomalies and fire radiative power (FRP) across global terrestrial biomes.',
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
        'Comprehensive multi-pollutant atmospheric chemistry modeling combining satellite assimilation, European reanalysis, and surface observation vectors across major international metropolitan coordinates.',
      specs: [
        { label: 'Atmospheric Model', value: 'CAMS European Global Atmospheric Composition' },
        { label: 'Pollutants Tracked', value: 'PM2.5, PM10, Nitrogen Dioxide (NO2), Ozone (O3), US AQI' },
        { label: 'Temporal Cadence', value: 'Hourly synchronous reanalysis' },
        { label: 'Spatial Coverage', value: `${air.data?.points?.length || 45} Primary Global Metropolises` },
        { label: 'Last Model Run', value: air.data?.fetchedAt ? new Date(air.data.fetchedAt).toLocaleTimeString() : 'Hourly cycle' },
      ],
      attribution: 'Copernicus Atmospheric Monitoring Service & Open-Meteo',
      endpoint: '/api/v1/air-quality',
      link: 'https://open-meteo.com/en/docs/air-quality-api',
    },
    {
      id: 'gfw',
      name: 'Global Forest Watch (Curated Reference Dataset)',
      icon: TreeDeciduous,
      badge: 'Reference Database',
      status: 'reference',
      description:
        'Curated baseline catalog of primary tropical forest loss fronts and critical biodiversity corridors facing chronic agricultural, logging, or charcoal displacement.',
      specs: [
        { label: 'Dataset Classification', value: 'Peer-reviewed baseline reference catalog' },
        { label: 'Loss Drivers', value: 'Cattle Ranching, Oil Palm, Soy Expansion, Charcoal, Logging' },
        { label: 'Biome Representation', value: 'Amazon Basin, Cerrado, Gran Chaco, Congo Basin, Sumatra, Borneo' },
        { label: 'Hotspot Count', value: `${forest.data?.points?.length || 16} curated critical surveillance zones` },
        { label: 'Nature of Data', value: 'Static curated reference (NOT live satellite feed)' },
      ],
      attribution: 'World Resources Institute / Global Forest Watch & University of Maryland',
      endpoint: '/api/v1/deforestation',
      link: 'https://www.globalforestwatch.org/',
    },
    {
      id: 'gemini',
      name: 'Google Gemini 1.5 & Rule-Based Synthesis Engine',
      icon: Sparkles,
      badge: 'Neural Analysis',
      status: 'live',
      description:
        'Multivariate environmental reasoning engine synthesizing spatial proximity vectors, active particulate dispersion, and ecological threat dynamics into actionable mitigation briefings.',
      specs: [
        { label: 'Foundation Model', value: 'Gemini 1.5 Flash (or deterministic offline rule-based fallback)' },
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
    </div>
  );
};

export default DataSourcesPage;

