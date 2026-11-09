import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardContext } from '@/components/dashboard/DashboardLayout';
import { DashboardWelcome } from '@/components/dashboard/DashboardWelcome';
import { EnvironmentalKpiGrid } from '@/components/dashboard/EnvironmentalKpiGrid';
import { EnvironmentalMap } from '@/components/dashboard/EnvironmentalMap';
import { EnvironmentalTrends } from '@/components/dashboard/EnvironmentalTrends';
import { MapPin, AlertTriangle, ArrowRight, Flame, ShieldAlert, Wind, TreeDeciduous } from 'lucide-react';
import type { SelectedPlace } from '@/types';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { overview, fires, air, forest, selectedPlace, setSelectedPlace } = useDashboardContext();

  const PRIORITY_LOCATIONS: {
    name: string;
    region: string;
    lat: number;
    lon: number;
    risk: 'Critical' | 'High' | 'Elevated';
    description: string;
    details: string[];
  }[] = [
    {
      name: 'Delhi NCR',
      region: 'National Capital Region',
      lat: 28.6139,
      lon: 77.2090,
      risk: 'Critical',
      description: 'Elevated atmospheric pollution across the metropolitan region.',
      details: [
        'Open-Meteo CAMS live atmospheric telemetry active',
        'Multi-pollutant dispersion tracking PM2.5, PM10, NO2',
        'Northern Gangetic basin atmospheric inversion monitoring',
      ],
    },
    {
      name: 'Western Ghats',
      region: 'Kerala / Karnataka / Tamil Nadu',
      lat: 11.4500,
      lon: 76.6500,
      risk: 'High',
      description: 'Forest ecosystem and canopy disturbance monitoring.',
      details: [
        'Global Forest Watch Indian AOI satellite surveillance active',
        'Tropical wet evergreen and montane shola forest buffer',
        'High endemism and climate vulnerability indicator zone',
      ],
    },
    {
      name: 'Sundarbans',
      region: 'West Bengal',
      lat: 21.9500,
      lon: 88.8500,
      risk: 'Critical',
      description: 'Coastal ecosystem and mangrove disturbance monitoring.',
      details: [
        'Tidal mangrove ecosystem monitoring',
        'Coastal halophytic forest buffer surveillance',
        'Sea level rise and coastal erosion indicator',
      ],
    },
    {
      name: 'Pune & Western Ghats',
      region: 'Maharashtra',
      lat: 18.5204,
      lon: 73.8567,
      risk: 'Elevated',
      description: 'Urban expansion and regional ecosystem monitoring.',
      details: [
        'Continuous CAMS multi-pollutant telemetry',
        'Mutha river catchment & Sahyadri hill corridor',
        'Urban-forest interface air mass trajectory tracking',
      ],
    },
  ];

  const handleSelectPriority = (loc: typeof PRIORITY_LOCATIONS[0]) => {
    setSelectedPlace({
      name: loc.name,
      lat: loc.lat,
      lon: loc.lon,
      kind: 'point',
      details: loc.details,
    });
  };

  // Recent real alerts list derived from active data
  const recentAlerts = useMemo(() => {
    const list: {
      id: string;
      category: 'Air Quality' | 'Fire Activity' | 'Forest Alert';
      icon: React.ComponentType<{ className?: string }>;
      title: string;
      location: string;
      severity: 'Critical' | 'High' | 'Moderate';
      source: string;
      time: string;
    }[] = [];

    // Unhealthy air cities
    (air.data?.points ?? [])
      .filter((p): p is typeof p & { usAqi: number } => p.usAqi != null && p.usAqi > 150)
      .slice(0, 2)
      .forEach((p, idx) => {
        list.push({
          id: `aq-${idx}`,
          category: 'Air Quality',
          icon: Wind,
          title: `AQI ${p.usAqi} (${p.category})`,
          location: `${p.name}, ${p.country}`,
          severity: p.usAqi > 200 ? 'Critical' : 'High',
          source: 'Copernicus CAMS',
          time: 'Active stream',
        });
      });

    // Top high-FRP fire
    const topFire = [...(fires.data?.points ?? [])].sort((a, b) => b.frp - a.frp)[0];
    if (topFire && topFire.frp > 80) {
      list.push({
        id: 'fire-top',
        category: 'Fire Activity',
        icon: Flame,
        title: `Thermal anomaly: ${Math.round(topFire.frp)} MW radiative power`,
        location: `${topFire.lat.toFixed(2)}°N, ${topFire.lon.toFixed(2)}°E`,
        severity: topFire.frp > 120 ? 'Critical' : 'High',
        source: 'NASA FIRMS',
        time: topFire.acquired || 'Recent pass',
      });
    }

    // Top live GFW deforestation alert (if ingested)
    const topLiveGfw = forest.data?.liveAlerts?.[0];
    if (topLiveGfw) {
      list.push({
        id: `gfw-${topLiveGfw.alert_id}`,
        category: 'Forest Alert',
        icon: TreeDeciduous,
        title: `Canopy disturbance (${topLiveGfw.confidence} confidence)`,
        location: `${topLiveGfw.latitude.toFixed(2)}°N, ${topLiveGfw.longitude.toFixed(2)}°E`,
        severity: topLiveGfw.confidence === 'high' ? 'Critical' : 'High',
        source: 'Global Forest Watch',
        time: topLiveGfw.alert_date,
      });
    }

    // Fallback: top curated reference forest hotspot
    const critForest = forest.data?.points.find((p) => p.severity === 'Critical');
    if (critForest && list.length < 4) {
      list.push({
        id: 'forest-top',
        category: 'Forest Alert',
        icon: TreeDeciduous,
        title: `Canopy loss front: ${critForest.driver}`,
        location: `${critForest.name}, ${critForest.country}`,
        severity: 'Critical',
        source: 'Global Forest Watch (Ref)',
        time: 'Reference dataset',
      });
    }

    return list.slice(0, 4);
  }, [air.data?.points, fires.data?.points, forest.data?.points, forest.data?.liveAlerts]);

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      {/* 1. System Welcome & Status Banner (No Manual Refresh Button) */}
      <DashboardWelcome
        firesLive={fires.data?.live}
        aqAvailable={!!air.data}
        lastUpdated={overview.data?.airQuality?.fetchedAt || overview.data?.fires?.fetchedAt}
      />

      {/* 2. Four KPI Cards */}
      <EnvironmentalKpiGrid
        overview={overview.data}
        fires={fires.data}
        air={air.data}
        forest={forest.data}
        loading={overview.loading || fires.loading}
      />

      {/* 3. Compact Map & Side Analysis */}
      <div className="min-w-0">
        <EnvironmentalMap
          fires={fires.data}
          air={air.data}
          forest={forest.data}
          selectedPlace={selectedPlace}
          onSelectPlace={setSelectedPlace}
        />
      </div>

      {/* 4. Telemetry Spectrum & Trends Chart */}
      <div className="min-w-0">
        <EnvironmentalTrends
          air={air.data}
          fires={fires.data}
          loading={air.loading || fires.loading}
        />
      </div>

      {/* 5. Priority Locations & Recent Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 min-w-0">
        {/* Priority Monitoring Fronts */}
        <div className="lg:col-span-7 rounded-xl bg-[#101F18] border border-emerald-950 p-4 sm:p-6 shadow-sm space-y-4 min-w-0">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-950/80">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-emerald-400 shrink-0" />
              <h3 className="text-lg sm:text-xl font-bold font-serif text-[#F2F5F2] tracking-tight">
                Priority Monitoring Fronts
              </h3>
            </div>
            <span className="text-xs text-[#9CAEA2] font-mono">4 Key Zones</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            {PRIORITY_LOCATIONS.map((loc) => {
              const isSelected = selectedPlace?.lat === loc.lat && selectedPlace?.lon === loc.lon;
              return (
                <div
                  key={loc.name}
                  onClick={() => handleSelectPriority(loc)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between min-w-0 ${
                    isSelected
                      ? 'bg-[#142D21] border-emerald-500/80 shadow-md ring-1 ring-emerald-500/30'
                      : 'bg-[#0D1914] border-emerald-950/80 hover:border-emerald-800 hover:bg-[#12241C]'
                  }`}
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <h4 className="text-base font-bold text-[#F2F5F2] truncate">{loc.name}</h4>
                        </div>
                        <p className="text-xs text-[#9CAEA2] pl-5 truncate">{loc.region}</p>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 ${
                          loc.risk === 'Critical'
                            ? 'bg-red-950/70 text-red-300 border border-red-800/60'
                            : loc.risk === 'High'
                            ? 'bg-amber-950/70 text-amber-300 border border-amber-800/60'
                            : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
                        }`}
                      >
                        {loc.risk} Risk
                      </span>
                    </div>

                    <p className="text-xs text-[#CBDAD0] leading-relaxed line-clamp-2 pt-0.5">
                      {loc.description}
                    </p>
                  </div>

                  <div className="pt-3 mt-2 border-t border-emerald-950/60 flex items-center justify-between text-xs text-emerald-400 font-medium">
                    <span>Inspect coordinates</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Telemetry Alerts */}
        <div className="lg:col-span-5 rounded-xl bg-[#101F18] border border-emerald-950 p-4 sm:p-6 shadow-sm space-y-4 flex flex-col justify-between min-w-0">
          <div className="space-y-3.5 min-w-0">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-950/80">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <h3 className="text-lg sm:text-xl font-bold font-serif text-[#F2F5F2] tracking-tight">
                  Live Telemetry Alerts
                </h3>
              </div>
              <button
                type="button"
                onClick={() => navigate('/dashboard/alerts')}
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer font-medium"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5 min-w-0">
              {recentAlerts.length > 0 ? (
                recentAlerts.map((a) => {
                  const Icon = a.icon;
                  return (
                    <div
                      key={a.id}
                      className="p-3 rounded-lg bg-[#0D1914] border border-emerald-950/80 flex items-start gap-2.5 min-w-0"
                    >
                      <div className="w-7 h-7 rounded-md bg-[#14251C] border border-emerald-900/60 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-semibold text-[#F2F5F2] truncate">{a.title}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase shrink-0 ${
                              a.severity === 'Critical'
                                ? 'bg-red-950/80 text-red-300 border border-red-800/60'
                                : 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                            }`}
                          >
                            {a.severity}
                          </span>
                        </div>
                        <p className="text-xs text-[#9CAEA2] truncate mt-0.5">{a.location}</p>
                        <div className="flex items-center justify-between text-[11px] text-[#82978B] mt-1 pt-1 border-t border-emerald-950/40">
                          <span className="truncate">{a.source}</span>
                          <span className="shrink-0 font-mono text-[10px]">{a.time}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-[#9CAEA2] py-6 text-center">No high-severity triggers in current telemetry window.</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/dashboard/alerts')}
            className="w-full mt-2 py-2.5 rounded-lg bg-[#14251C] hover:bg-[#174C34] text-xs font-semibold text-emerald-300 border border-emerald-800/60 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Manage All Active Environmental Alerts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;
