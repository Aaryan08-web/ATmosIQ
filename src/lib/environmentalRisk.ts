/**
 * ATmosIQ — Environmental Risk Scoring Engine
 *
 * Implements a transparent, data-driven composite environmental risk calculation.
 * Strictly avoids arbitrary default values:
 * - Missing AQI is NOT treated as 120 (remains unmeasured/unavailable).
 * - Missing forest data does NOT contribute arbitrary penalty points.
 * - Dispersion does NOT receive an arbitrary fixed baseline.
 * - Returns "Insufficient Data" when no valid indicators are available.
 * - Dynamically weights available indicators and returns data coverage & confidence metrics.
 */

export type RiskIndicator = {
  score: number;
  weight: number;
  available: boolean;
  reason?: string;
};

export type EnvironmentalRiskLevel =
  | 'Low'
  | 'Moderate'
  | 'High'
  | 'Critical'
  | 'Insufficient Data';

export type EnvironmentalRiskConfidence = 'Low' | 'Medium' | 'High';

export type EnvironmentalRiskResult = {
  score: number | null;
  level: EnvironmentalRiskLevel;
  confidence: EnvironmentalRiskConfidence;
  coverage: number;
  indicators: {
    airQuality: RiskIndicator;
    fireActivity: RiskIndicator;
    forestLoss: RiskIndicator;
  };
};

export interface EnvironmentalRiskInput {
  aqi?: number | null;
  fireCount?: number | null;
  totalFrp?: number | null;
  forestDistanceKm?: number | null;
}

export function calculateEnvironmentalRisk(
  input: EnvironmentalRiskInput
): EnvironmentalRiskResult {
  const indicators: EnvironmentalRiskResult['indicators'] = {
    airQuality: {
      score: 0,
      weight: 40,
      available: false,
    },
    fireActivity: {
      score: 0,
      weight: 35,
      available: false,
    },
    forestLoss: {
      score: 0,
      weight: 25,
      available: false,
    },
  };

  // Air quality: only calculate when valid AQI exists.
  if (
    input.aqi !== null &&
    input.aqi !== undefined &&
    Number.isFinite(input.aqi) &&
    input.aqi >= 0
  ) {
    indicators.airQuality.available = true;
    // Normalize against the 0–300 AQI scale (capped at 100).
    indicators.airQuality.score = Math.min(100, (input.aqi / 300) * 100);
  } else {
    indicators.airQuality.reason = 'Air quality observation unavailable';
  }

  // Fire activity: only calculate when actual fire data exists.
  if (
    input.fireCount !== null &&
    input.fireCount !== undefined &&
    Number.isFinite(input.fireCount) &&
    input.fireCount >= 0
  ) {
    const countScore = Math.min(100, (input.fireCount / 15) * 100);

    const totalFrp = input.totalFrp;
    const frpScore =
      totalFrp !== null &&
      totalFrp !== undefined &&
      Number.isFinite(totalFrp) &&
      totalFrp >= 0
        ? Math.min(100, (totalFrp / 500) * 100)
        : null;

    indicators.fireActivity.available = true;
    indicators.fireActivity.score =
      frpScore === null
        ? countScore
        : countScore * 0.6 + frpScore * 0.4;
  } else {
    indicators.fireActivity.reason = 'Thermal fire telemetry unavailable';
  }

  // Forest proximity: calculate only when actual measured forest distance exists.
  // Proximity alone is treated as a geographic proximity factor, not confirmed tree cover loss.
  if (
    input.forestDistanceKm !== null &&
    input.forestDistanceKm !== undefined &&
    Number.isFinite(input.forestDistanceKm) &&
    input.forestDistanceKm >= 0
  ) {
    indicators.forestLoss.available = true;
    indicators.forestLoss.score = Math.max(
      0,
      Math.min(100, ((150 - input.forestDistanceKm) / 150) * 100)
    );
  } else {
    indicators.forestLoss.reason = 'No monitored forest front within observation buffer';
  }

  const availableIndicators = Object.values(indicators).filter(
    (item) => item.available
  );

  if (availableIndicators.length === 0) {
    return {
      score: null,
      level: 'Insufficient Data',
      confidence: 'Low',
      coverage: 0,
      indicators,
    };
  }

  const availableWeight = availableIndicators.reduce(
    (sum, item) => sum + item.weight,
    0
  );

  const weightedScore = availableIndicators.reduce(
    (sum, item) => sum + item.score * item.weight,
    0
  );

  const score = Math.round(weightedScore / availableWeight);
  const coverage = Math.round((availableWeight / 100) * 100);

  const level: EnvironmentalRiskLevel =
    score >= 75
      ? 'Critical'
      : score >= 50
      ? 'High'
      : score >= 25
      ? 'Moderate'
      : 'Low';

  const confidence: EnvironmentalRiskConfidence =
    coverage >= 80 ? 'High' : coverage >= 50 ? 'Medium' : 'Low';

  return {
    score,
    level,
    confidence,
    coverage,
    indicators,
  };
}
