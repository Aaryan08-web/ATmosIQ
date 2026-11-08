import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardContext } from '@/components/dashboard/DashboardLayout';
import { DashboardWelcome } from '@/components/dashboard/DashboardWelcome';
import { EnvironmentalKpiGrid } from '@/components/dashboard/EnvironmentalKpiGrid';
import { EnvironmentalMap } from '@/components/dashboard/EnvironmentalMap';
import { EnvironmentalTrends } from '@/components/dashboard/EnvironmentalTrends';
import { MapPin, AlertTriangle, ArrowRight, Flame, ShieldAlert, Wind } from 'lucide-react';
import type { SelectedPlace } from '@/types';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { overview, fires, air, forest, refreshAll, selectedPlace, setSelectedPlace } = useDashboardContext();

  const PRIORITY_LOCATIONS: {
    name: string;
    region: string;
    lat: number;
    lon: number;
    risk: 'Critical' | 'High' | 'Elevated';
    reason: string;
    details: string[];
  }[] = [
    {
      name: 'Delhi NCR Environmental Observatory',
      region: 'National Capital Region, India',
      lat: 28.6139,
      lon: 77.2090,
      risk: 'Critical',
      reason: 'Dense urban atmospheric particulate accumulation & post-monsoon thermal anomalies',
      details: [
        'Open-Meteo CAMS live atmospheric telemetry active',
        'Multi-pollutant dispersion tracking PM2.5 and PM10',
        'Central Ridge ecological buffer bounded within 3.5 km',
      ],
    },
    {
      name: 'Sumatra Peatland Forest Zone',
      region: 'Riau Province, Indonesia',
      lat: 0.5333,
      lon: 101.4500,
      risk: 'High',
      reason: 'Seasonal agricultural clearance thermal clusters & tropical peatland degradation',
      details: [
        'NASA FIRMS satellite VIIRS 375m thermal pass monitoring',
        'Tropical moist broadleaf forest biome conservation area',
        'Transboundary haze dispersal tracking active',
      ],
    },
    {
      name: 'Cerrado MATOPIBA Agricultural Frontier',
      region: 'Bahia / Tocantins, Brazil',
      lat: -12.1500,
      lon: -45.0000,
      risk: 'Critical',
      reason: 'Rapid savanna biome fragmentation and accelerated soy/cattle conversion',
      details: [
        'Global Forest Watch curated reference loss front',
        'Biodiversity corridor buffer under continuous satellite surveillance',
        'High drought vulnerability index detected',
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
      title: string;
      location: string;
      severity: 'Critical' | 'High' | 'Moderate';
      source: string;
      time: string;
    }[] = [];

    // Unhealthy air cities
    (air.data?.points ?? [])
      .filter((p): p is typeof p & { usAqi: number } => p.usAqi != null && p.usAqi > 150)
      .slice(0, 3)
      .forEach((p, idx) => {
        list.push({
          id: `aq-${idx}`,
          title: `AQI ${p.usAqi} (${p.category})`,
          location: `${p.name}, ${p.country}`,
          severity: p.usAqi > 200 ? 'Critical' : 'High',
          source: 'Open-Meteo / CAMS',
          time: 'Active stream',
        });
      });

    // Top high-FRP fire
    const topFire = [...(fires.data?.points ?? [])].sort((a, b) => b.frp - a.frp)[0];
    if (topFire && topFire.frp > 80) {
      list.push({
        id: 'fire-top',
        title: `Thermal anomaly: ${Math.round(topFire.frp)} MW radiative power`,
        location: `${topFire.lat.toFixed(2)}°N, ${topFire.lon.toFixed(2)}°E`,
        severity: topFire.frp > 120 ? 'Critical' : 'High',
        source: 'NASA FIRMS VIIRS',
        time: topFire.acquired || 'Last pass',
      });
    }

    // Critical forest loss hotspot
    const critForest = forest.data?.points.find((p) => p.severity === 'Critical');
    if (critForest) {
      list.push({
        id: 'forest-top',
        title: `Forest loss front: ${critForest.driver}`,
        location: `${critForest.name}, ${critForest.country}`,
        severity: 'Critical',
        source: 'Global Forest Watch',
        time: 'Reference dataset',
      });
    }

    return list.slice(0, 4);
  }, [air.data?.points, fires.data?.points, forest.data?.points]);

  return (
    <div className="space-y-8">
      {/* 1. System Welcome & Status Banner */}
      <DashboardWelcome
        firesLive={fires.data?.live}
        aqAvailable={!!air.data}
        lastUpdated={overview.data?.airQuality?.fetchedAt || overview.data?.fires?.fetchedAt}
        onRefresh={refreshAll}
        loading={overview.loading || fires.loading || air.loading}
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
      <div>
        <EnvironmentalMap
          fires={fires.data}
          air={air.data}
          forest={forest.data}
          selectedPlace={selectedPlace}
          onSelectPlace={setSelectedPlace}
        />
      </div>

      {/* 4. Telemetry Spectrum & Trends Chart */}
      <EnvironmentalTrends
        air={air.data}
        fires={fires.data}
        loading={air.loading || fires.loading}
      />

      {/* 5. Priority Locations & Recent Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Three Priority Locations */}
        <div className="lg:col-span-7 rounded-xl bg-[#101F18] border border-emerald-950 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3.5 border-b border-emerald-950/80">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-6 h-6 text-emerald-400" />
              <h3 className="text-[22px] sm:text-[24px] font-bold text-[#F2F5F2] tracking-tight">Priority Environmental Fronts</h3>
            </div>
            <span className="text-[13px] text-[#9CAEA2]">3 Key Monitoring Zones</span>
          </div>

          <div className="space-y-3.5">
            {PRIORITY_LOCATIONS.map((loc) => {
              const isSelected = selectedPlace?.lat === loc.lat && selectedPlace?.lon === loc.lon;
              return (
                <div
                  key={loc.name}
                  onClick={() => handleSelectPriority(loc)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#142D21] border-emerald-500/80 shadow-md'
                      : 'bg-[#0D1914] border-emerald-950/80 hover:border-emerald-800 hover:bg-[#12241C]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                        <h4 className="text-[18px] sm:text-[19px] font-bold text-[#F2F5F2]">{loc.name}</h4>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                            loc.risk === 'Critical'
                              ? 'bg-red-950/70 text-red-300 border border-red-800/60'
                              : 'bg-amber-950/70 text-amber-300 border border-amber-800/60'
                          }`}
                        >
                          {loc.risk} Risk
                        </span>
                      </div>
                      <p className="text-[14px] text-[#9CAEA2] pl-6 font-medium">{loc.region}</p>
                      <p className="text-[15px] sm:text-[16px] text-[#CBDAD0] pl-6 pt-1 leading-relaxed">{loc.reason}</p>
                    </div>

                    <button
                      type="button"
                      className="shrink-0 p-2 text-[14px] font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/60 rounded-lg transition-colors cursor-pointer"
                      title="Inspect coordinates on map"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Real Environmental Alerts */}
        <div className="lg:col-span-5 rounded-xl bg-[#101F18] border border-emerald-950 p-6 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-emerald-950/80">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
                <h3 className="text-[22px] sm:text-[24px] font-bold text-[#F2F5F2] tracking-tight">Live Telemetry Alerts</h3>
              </div>
              <button
                type="button"
                onClick={() => navigate('/dashboard/alerts')}
                className="text-[14px] text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <span>View all</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {recentAlerts.length > 0 ? (
                recentAlerts.map((a) => (
                  <div
                    key={a.id}
                    className="p-3.5 rounded-lg bg-[#0D1914] border border-emerald-950/80 flex items-start gap-3"
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                        a.severity === 'Critical' ? 'bg-red-400 animate-pulse' : 'bg-amber-400'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[15px] font-semibold text-[#F2F5F2] truncate">{a.title}</span>
                        <span className="text-[12px] text-[#9CAEA2] shrink-0">{a.time}</span>
                      </div>
                      <p className="text-[14px] text-[#9CAEA2] truncate mt-0.5">{a.location}</p>
                      <span className="text-[12px] text-emerald-400/80 block mt-1">
                        Source: {a.source}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[15px] text-[#9CAEA2] py-6 text-center">No high-severity triggers in current telemetry window.</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/dashboard/alerts')}
            className="w-full mt-2 py-3 rounded-lg bg-[#14251C] hover:bg-[#174C34] text-[15px] sm:text-[16px] font-medium text-emerald-300 border border-emerald-800/60 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Manage All Active Environmental Alerts</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;
