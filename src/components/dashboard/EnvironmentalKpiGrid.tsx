import React, { useMemo } from 'react';
import { ShieldAlert, AlertTriangle, Wind, Flame } from 'lucide-react';
import type { Overview, FireResult, AqResult, DeforestationResult } from '@/types';
import { EnvironmentalKpiCard } from './EnvironmentalKpiCard';

interface KpiGridProps {
  overview: Overview | null;
  fires: FireResult | null;
  air: AqResult | null;
  forest: DeforestationResult | null;
  loading?: boolean;
}

export const EnvironmentalKpiGrid: React.FC<KpiGridProps> = ({
  overview,
  fires,
  air,
  forest,
  loading = false,
}) => {
  // Calculations based on live data
  const worstAq = overview?.airQuality?.worst;
  const unhealthyStations = overview?.airQuality?.unhealthy || 0;
  const totalStations = overview?.airQuality?.stations || 45;
  const fireCount = fires?.points?.length || overview?.fires?.total || 0;
  const totalFrp = useMemo(() => {
    return Math.round((fires?.points ?? []).reduce((acc, p) => acc + (p.frp || 0), 0));
  }, [fires?.points]);

  const criticalHotspots = forest?.points?.filter((p) => p.severity === 'Critical').length || 0;
  const activeAlertsCount = unhealthyStations + criticalHotspots + (fires?.points?.filter(p => p.frp > 80).length || 0);

  // Composite Environmental Risk Index calculation (0 - 100)
  const riskIndex = useMemo(() => {
    let score = 25; // baseline
    if (worstAq && worstAq.usAqi) {
      score += Math.min(35, (worstAq.usAqi / 300) * 35);
    }
    if (fireCount > 0) {
      score += Math.min(25, (fireCount / 200) * 25);
    }
    if (criticalHotspots > 0) {
      score += Math.min(15, criticalHotspots * 3);
    }
    return Math.min(100, Math.round(score));
  }, [worstAq, fireCount, criticalHotspots]);

  const riskCategory = riskIndex > 75 ? 'Critical' : riskIndex > 50 ? 'High' : riskIndex > 30 ? 'Moderate' : 'Low';
  const riskVariant = riskIndex > 75 ? 'red' : riskIndex > 50 ? 'amber' : riskIndex > 30 ? 'amber' : 'emerald';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Environmental Risk Index */}
      <EnvironmentalKpiCard
        title="Environmental Risk Index"
        value={`${riskIndex}/100`}
        subtitle={`${riskCategory} risk based on multi-sensor telemetry`}
        icon={ShieldAlert}
        badge={{
          label: riskCategory,
          variant: riskVariant,
        }}
        trend={{
          label: riskIndex > 50 ? 'Elevated threat' : 'Stable conditions',
          positive: riskIndex <= 50,
          neutral: riskIndex <= 30,
        }}
        details={[
          { label: 'Air Risk', value: worstAq ? `${worstAq.category}` : 'Normal' },
          { label: 'Thermal Hotspots', value: `${fireCount}` },
        ]}
        linkTo="/dashboard/risk-analysis"
        loading={loading}
      />

      {/* Card 2: Active Environmental Alerts */}
      <EnvironmentalKpiCard
        title="Active Environmental Alerts"
        value={activeAlertsCount}
        subtitle="Unhealthy AQI cities & critical forest biomes"
        icon={AlertTriangle}
        badge={{
          label: activeAlertsCount > 5 ? 'High Alert' : 'Active',
          variant: activeAlertsCount > 5 ? 'red' : 'amber',
        }}
        trend={{
          label: `${unhealthyStations} high AQI · ${criticalHotspots} forest loss`,
          positive: activeAlertsCount === 0,
        }}
        details={[
          { label: 'Air > 150 AQI', value: `${unhealthyStations} cities` },
          { label: 'Critical Biomes', value: `${criticalHotspots}` },
        ]}
        linkTo="/dashboard/alerts"
        loading={loading}
      />

      {/* Card 3: Air Quality Index */}
      <EnvironmentalKpiCard
        title="Air Quality Index"
        value={worstAq?.usAqi != null ? `${worstAq.usAqi} AQI` : '—'}
        subtitle={
          worstAq
            ? `Worst: ${worstAq.name}, ${worstAq.country} (${worstAq.category})`
            : 'European CAMS continuous atmospheric monitoring'
        }
        icon={Wind}
        badge={{
          label: worstAq?.category || 'CAMS',
          variant:
            (worstAq?.usAqi || 0) > 150 ? 'red' : (worstAq?.usAqi || 0) > 100 ? 'amber' : 'emerald',
        }}
        details={[
          { label: 'Monitored Cities', value: `${totalStations}` },
          { label: 'Unhealthy Count', value: `${unhealthyStations}` },
        ]}
        linkTo="/dashboard/atmospheric"
        loading={loading}
        provenance="Open-Meteo / CAMS"
      />

      {/* Card 4: Active Fire Detections */}
      <EnvironmentalKpiCard
        title="Active Fire Detections"
        value={fireCount}
        subtitle={`Thermal radiative power: ${totalFrp.toLocaleString()} MW`}
        icon={Flame}
        badge={{
          label: fires?.live ? 'Live VIIRS' : 'Sample',
          variant: fires?.live ? 'emerald' : 'amber',
        }}
        details={[
          { label: 'Combined FRP', value: `${totalFrp} MW` },
          { label: 'Window', value: 'Last 24 Hours' },
        ]}
        linkTo="/dashboard/map"
        loading={loading}
        provenance="NASA FIRMS · 375m"
      />
    </div>
  );
};

export default EnvironmentalKpiGrid;
