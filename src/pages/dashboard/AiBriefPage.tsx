import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDashboardContext } from '@/components/dashboard/DashboardLayout';
import {
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  MapPin,
  Wind,
  Flame,
  TreeDeciduous,
  Copy,
  Check,
  Printer,
  Activity,
  ShieldCheck,
  Clock,
  Compass,
  AlertTriangle,
  Sliders,
  Database,
  Radio,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import {
  calculateEnvironmentalRisk,
  type EnvironmentalRiskResult,
} from '@/lib/environmentalRisk';
import type { AiSummary, SelectedPlace } from '@/types';

export interface AiBriefPageProps {
  initialSummary?: AiSummary | null;
  initialPlace?: SelectedPlace;
}

export type SyncStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'unavailable';

export type SyncSource = {
  id: string;
  label: string;
  status: SyncStatus;
  message?: string;
};

const INITIAL_SYNC_SOURCES: SyncSource[] = [
  { id: 'firms', label: 'NASA FIRMS Fire Monitoring', status: 'pending' },
  { id: 'cams', label: 'CAMS Air Quality', status: 'pending' },
  { id: 'gfw', label: 'Global Forest Watch', status: 'pending' },
  { id: 'risk', label: 'Environmental Risk Analysis', status: 'pending' },
  { id: 'gemini', label: 'Gemini AI Generation', status: 'pending' },
];

export function updateSyncSource(
  sources: SyncSource[],
  id: string,
  status: SyncStatus,
  message?: string
): SyncSource[] {
  return sources.map((source) =>
    source.id === id ? { ...source, status, message } : source
  );
}

const PRESET_PLACES: SelectedPlace[] = [
  {
    name: 'Delhi NCR',
    lat: 28.6139,
    lon: 77.2090,
    kind: 'point',
    details: ['Indo-Gangetic Basin Particulate Dispersion Center', 'CAMS Atmospheric Model & CPCB Grid'],
  },
  {
    name: 'Pune & Western Ghats',
    lat: 18.5204,
    lon: 73.8567,
    kind: 'point',
    details: ['Deccan Plateau urban-forest interface', 'Western Ghats ecological corridor'],
  },
  {
    name: 'Mumbai Coastal',
    lat: 19.0760,
    lon: 72.8777,
    kind: 'point',
    details: ['Arabian Sea coastal boundary layer', 'Metropolitan emissions corridor'],
  },
  {
    name: 'Bengaluru Plateau',
    lat: 12.9716,
    lon: 77.5946,
    kind: 'point',
    details: ['Southern plateau watershed & urban heat island monitoring', 'Cauvery basin buffer'],
  },
  {
    name: 'Kolkata Delta',
    lat: 22.5726,
    lon: 88.3639,
    kind: 'point',
    details: ['Lower Gangetic plains & industrial dispersion', 'Sundarbans northern buffer'],
  },
  {
    name: 'Chennai Coastal',
    lat: 13.0827,
    lon: 80.2707,
    kind: 'point',
    details: ['Coromandel Coast maritime boundary', 'Ennore wetland & port industrial belt'],
  },
  {
    name: 'Sundarbans Biosphere',
    lat: 21.9500,
    lon: 88.8500,
    kind: 'point',
    details: ['Tidal mangrove forest delta buffer', 'UNESCO World Heritage coastal wetland'],
  },
  {
    name: 'Western Ghats (Nilgiri)',
    lat: 11.4500,
    lon: 76.6500,
    kind: 'point',
    details: ['UNESCO World Heritage tropical evergreen corridor', 'GFW satellite surveillance AOI'],
  },
  {
    name: 'Kaziranga Floodplain',
    lat: 26.5775,
    lon: 93.1711,
    kind: 'point',
    details: ['Brahmaputra Valley wet alluvial grassland', 'High-biodiversity national park buffer'],
  },
  {
    name: 'Dehradun Shivalik',
    lat: 30.3165,
    lon: 78.0322,
    kind: 'point',
    details: ['Sub-Himalayan Shivalik ecological zone', 'Rajaji-Corbett elephant corridor buffer'],
  },
];

export const AiBriefPage: React.FC<AiBriefPageProps> = ({ initialSummary = null, initialPlace }) => {
  // Safe dashboard context extraction (supports SSR/test environments without router)
  let dashboardContext: ReturnType<typeof useDashboardContext> | null = null;
  try {
    dashboardContext = useDashboardContext();
  } catch {
    dashboardContext = null;
  }

  const selectedPlace = initialPlace ?? dashboardContext?.selectedPlace;
  const setSelectedPlace = dashboardContext?.setSelectedPlace ?? (() => {});

  const [summary, setSummary] = useState<AiSummary | null>(initialSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bypassCache, setBypassCache] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number>(() => dashboardContext?.selectedRadiusKm || 150);

  // Truthful API synchronization source states
  const [syncSources, setSyncSources] = useState<SyncSource[]>(() => {
    if (initialSummary) {
      const ctx = initialSummary.context;
      const aqi = ctx.airQuality?.usAqi != null && Number.isFinite(ctx.airQuality.usAqi) ? ctx.airQuality.usAqi : null;
      const fireCount = ctx.fires && Number.isFinite(ctx.fires.count) ? ctx.fires.count : null;
      const totalFrp = ctx.fires && Number.isFinite(ctx.fires.totalFrp) ? ctx.fires.totalFrp : null;
      const closestForest = ctx.deforestation && ctx.deforestation.length > 0 ? ctx.deforestation[0] : null;
      const forestDistanceKm = closestForest && Number.isFinite(closestForest.distanceKm) ? closestForest.distanceKm : null;
      const riskRes = calculateEnvironmentalRisk({ aqi, fireCount, totalFrp, forestDistanceKm });

      return [
        {
          id: 'firms',
          label: 'NASA FIRMS Fire Monitoring',
          status: 'completed',
          message: `${ctx.fires.count} fire detection(s) within ${ctx.radiusKm} km buffer`,
        },
        {
          id: 'cams',
          label: 'CAMS Air Quality',
          status: ctx.airQuality ? 'completed' : 'unavailable',
          message: ctx.airQuality
            ? `${ctx.airQuality.station} (US AQI ${ctx.airQuality.usAqi ?? 'n/a'})`
            : 'Atmospheric telemetry unavailable',
        },
        {
          id: 'gfw',
          label: 'Global Forest Watch',
          status: 'completed',
          message: ctx.deforestation && ctx.deforestation.length > 0
            ? `${ctx.deforestation.length} catalogued front(s)`
            : 'No catalogued deforestation fronts within buffer',
        },
        {
          id: 'risk',
          label: 'Environmental Risk Analysis',
          status: riskRes.score !== null ? 'completed' : 'unavailable',
          message: riskRes.score !== null
            ? `Estimated Composite Risk: ${riskRes.score}/100 (${riskRes.level})`
            : 'Insufficient indicator data',
        },
        {
          id: 'gemini',
          label: 'Gemini AI Generation',
          status: initialSummary.source === 'gemini' ? 'completed' : 'unavailable',
          message: initialSummary.source === 'gemini'
            ? 'AI brief generated via Gemini'
            : 'AI service unavailable · Rule-based brief applied',
        },
      ];
    }
    return INITIAL_SYNC_SOURCES;
  });

  const [copiedToast, setCopiedToast] = useState(false);
  const [selectedHorizon, setSelectedHorizon] = useState<'immediate' | 'short' | 'medium' | 'long' | 'all'>('all');

  // Custom coordinate inputs
  const [showCustomCoords, setShowCustomCoords] = useState(false);
  const [customLatInput, setCustomLatInput] = useState('');
  const [customLonInput, setCustomLonInput] = useState('');
  const [customNameInput, setCustomNameInput] = useState('');
  const [coordError, setCoordError] = useState<string | null>(null);

  // In-flight guard, request ID to discard stale responses, and auto-trigger deduplication
  const inFlightRef = useRef(false);
  const requestIdRef = useRef(0);
  const autoTriggeredKeyRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const place: SelectedPlace = selectedPlace || {
    name: 'Delhi NCR Central Environmental Observatory',
    lat: 28.6139,
    lon: 77.2090,
    kind: 'point',
    details: [
      'National Capital Region, India · Prime Atmospheric Sensor Hub',
      'Air quality telemetry active via CAMS South Asia model & CPCB ground array',
      'Delhi Central Ridge ecological reserve bounded within 3.5 km',
    ],
  };

  // Synchronize radius with context
  useEffect(() => {
    if (dashboardContext?.selectedRadiusKm && dashboardContext.selectedRadiusKm !== radiusKm) {
      setRadiusKm(dashboardContext.selectedRadiusKm);
    }
  }, [dashboardContext?.selectedRadiusKm]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const triggerGenerate = useCallback(
    async (targetPlace: SelectedPlace, targetRadius: number, shouldBypass: boolean) => {
      // Prevent overlapping concurrent executions
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      const requestId = ++requestIdRef.current;

      // Abort previous in-flight request if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Sovereign Republic of India boundaries check (6.5°N - 37.5°N, 68.0°E - 97.5°E)
      if (
        targetPlace.lat < 6.5 ||
        targetPlace.lat > 37.5 ||
        targetPlace.lon < 68.0 ||
        targetPlace.lon > 97.5
      ) {
        setError('Selected coordinates fall outside the sovereign territory of the Republic of India (6.5°N–37.5°N, 68.0°E–97.5°E).');
        inFlightRef.current = false;
        return;
      }

      setLoading(true);
      setError(null);

      // Truthful initial sync state (running actual network operations)
      setSyncSources([
        { id: 'firms', label: 'NASA FIRMS Fire Monitoring', status: 'running', message: 'Collecting satellite thermal anomaly telemetry...' },
        { id: 'cams', label: 'CAMS Air Quality', status: 'running', message: 'Retrieving multi-pollutant atmospheric observations...' },
        { id: 'gfw', label: 'Global Forest Watch', status: 'running', message: 'Correlating satellite canopy disturbance data...' },
        { id: 'risk', label: 'Environmental Risk Analysis', status: 'pending', message: 'Awaiting verified sensor feeds...' },
        { id: 'gemini', label: 'Gemini AI Generation', status: 'pending', message: 'Awaiting environmental telemetry context...' },
      ]);

      try {
        const res = await api<AiSummary>('/ai/summary', {
          method: 'POST',
          signal: controller.signal,
          json: {
            name: targetPlace.name,
            lat: targetPlace.lat,
            lon: targetPlace.lon,
            radiusKm: targetRadius,
            bypassCache: shouldBypass,
          },
        });

        // Discard stale responses if a newer request was dispatched
        if (requestId !== requestIdRef.current) return;

        setSummary(res);

        // Derive truthful source states from actual verified response data
        const aqi = res.context.airQuality?.usAqi != null && Number.isFinite(res.context.airQuality.usAqi) ? res.context.airQuality.usAqi : null;
        const fireCount = res.context.fires && Number.isFinite(res.context.fires.count) ? res.context.fires.count : null;
        const totalFrp = res.context.fires && Number.isFinite(res.context.fires.totalFrp) ? res.context.fires.totalFrp : null;
        const closestForest = res.context.deforestation && res.context.deforestation.length > 0 ? res.context.deforestation[0] : null;
        const forestDistanceKm = closestForest && Number.isFinite(closestForest.distanceKm) ? closestForest.distanceKm : null;

        const riskRes = calculateEnvironmentalRisk({ aqi, fireCount, totalFrp, forestDistanceKm });

        setSyncSources([
          {
            id: 'firms',
            label: 'NASA FIRMS Fire Monitoring',
            status: 'completed',
            message: `${res.context.fires.count} fire detection(s) within ${res.context.radiusKm} km buffer (${res.context.fires.live ? 'live pass' : 'satellite telemetry'})`,
          },
          {
            id: 'cams',
            label: 'CAMS Air Quality',
            status: res.context.airQualityStatus === 'ok' && res.context.airQuality ? 'completed' : 'unavailable',
            message: res.context.airQualityStatus === 'ok' && res.context.airQuality
              ? `${res.context.airQuality.station} (US AQI ${res.context.airQuality.usAqi ?? 'n/a'} · ${res.context.airQuality.category})`
              : res.context.airQualityStatus === 'unavailable'
              ? 'Atmospheric model telemetry currently unavailable'
              : 'No monitored station within 500 km',
          },
          {
            id: 'gfw',
            label: 'Global Forest Watch',
            status: 'completed',
            message: res.context.deforestation && res.context.deforestation.length > 0
              ? `${res.context.deforestation.length} catalogued front(s) (nearest: ${res.context.deforestation[0].name}, ${res.context.deforestation[0].distanceKm} km)`
              : 'No catalogued deforestation front within 800 km',
          },
          {
            id: 'risk',
            label: 'Environmental Risk Analysis',
            status: riskRes.score !== null ? 'completed' : 'unavailable',
            message: riskRes.score !== null
              ? `Estimated Composite Risk: ${riskRes.score}/100 (${riskRes.level}) · Data Coverage: ${riskRes.coverage}% (${riskRes.confidence} Confidence)`
              : 'Insufficient indicator data to compute composite index',
          },
          {
            id: 'gemini',
            label: 'Gemini AI Generation',
            status: res.source === 'gemini' ? 'completed' : 'unavailable',
            message: res.source === 'gemini'
              ? `AI brief generated successfully via ${res.model || 'Gemini multi-model pipeline'}`
              : `AI service unavailable (${res.fallbackReason || 'fallback active'}) · Rule-based brief applied`,
          },
        ]);
      } catch (e: unknown) {
        if (controller.signal.aborted) return;
        if (requestId === requestIdRef.current) {
          setError(e instanceof ApiError ? e.message : 'Could not generate environmental brief at this time.');
          setSyncSources((prev) =>
            prev.map((s) => ({
              ...s,
              status: s.status === 'completed' ? 'completed' : 'failed',
              message: s.status === 'completed' ? s.message : 'Environmental data synchronization failed.',
            }))
          );
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          inFlightRef.current = false;
        }
      }
    },
    []
  );

  // Parse URL search parameters on mount (supporting navigation with auto-generation, safe for StrictMode)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const qAuto = urlParams.get('auto') === 'true';
      const qName = urlParams.get('name');
      const qLat = Number(urlParams.get('lat'));
      const qLon = Number(urlParams.get('lon'));
      const qRadius = Number(urlParams.get('radius') ?? 150);

      if (!qAuto || !qName) return;

      const validCoordinates =
        Number.isFinite(qLat) &&
        Number.isFinite(qLon) &&
        qLat >= 6.5 &&
        qLat <= 37.5 &&
        qLon >= 68.0 &&
        qLon <= 97.5;

      if (!validCoordinates) {
        setError('Invalid Indian location coordinates. Allowed bounds: 6.5°N–37.5°N, 68.0°E–97.5°E.');
        return;
      }

      const resolvedRadius = Number.isFinite(qRadius) && qRadius > 0 ? qRadius : 150;
      const locationKey = `${qName}:${qLat.toFixed(4)}:${qLon.toFixed(4)}:${resolvedRadius}`;

      // Deduplicate: prevent StrictMode or duplicate re-renders from executing multiple times
      if (autoTriggeredKeyRef.current === locationKey) return;
      autoTriggeredKeyRef.current = locationKey;

      const newPlace: SelectedPlace = {
        name: qName,
        lat: qLat,
        lon: qLon,
        kind: 'point',
        details: [
          `Observation Target: ${qLat.toFixed(4)}°N, ${qLon.toFixed(4)}°E`,
          `Surveillance Radius: ${resolvedRadius} km`,
        ],
      };

      setSelectedPlace(newPlace);
      setRadiusKm(resolvedRadius);
      if (dashboardContext?.setSelectedRadiusKm) {
        dashboardContext.setSelectedRadiusKm(resolvedRadius);
      }

      triggerGenerate(newPlace, resolvedRadius, false);
    } catch {
      // Ignored for non-browser / test environments
    }
  }, [dashboardContext, setSelectedPlace, triggerGenerate]);

  const handleGenerateBrief = useCallback(
    (shouldBypass = false) => {
      triggerGenerate(place, radiusKm, shouldBypass);
    },
    [place, radiusKm, triggerGenerate]
  );

  // Apply custom coordinate input
  const handleApplyCustomCoords = (e: React.FormEvent) => {
    e.preventDefault();
    setCoordError(null);
    const lat = parseFloat(customLatInput);
    const lon = parseFloat(customLonInput);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setCoordError('Please provide valid decimal coordinates for latitude and longitude.');
      return;
    }
    if (lat < 6.5 || lat > 37.5 || lon < 68.0 || lon > 97.5) {
      setCoordError('Coordinates must be located within Indian sovereign territory (6.5°N–37.5°N, 68.0°E–97.5°E).');
      return;
    }

    const newPlace: SelectedPlace = {
      name: customNameInput.trim() || `Station (${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E)`,
      lat,
      lon,
      kind: 'point',
      details: [`Custom Observation Point: ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`, `Configured Radius: ${radiusKm} km`],
    };
    setSelectedPlace(newPlace);
    setShowCustomCoords(false);
    triggerGenerate(newPlace, radiusKm, bypassCache);
  };

  // Data-driven structured multi-section decomposition (supporting both neural 6-section output and rule-based fallback)
  const structuredReport = useMemo(() => {
    if (!summary?.summary) return null;
    const text = summary.summary;
    const ctx = summary.context;

    // Detect section splits in text if present
    const section1Match = text.match(/(?:1\.\s*Current\s+Environmental\s+Situation|1\.\s*Current\s+Situation)[:\s-]*([\s\S]*?)(?=(?:2\.\s*Environmental\s+Risk|2\.\s*Risk|2\.\s*Potential|$))/i);
    const section2Match = text.match(/(?:2\.\s*Environmental\s+Risk\s+Assessment|2\.\s*Risk\s+Assessment)[:\s-]*([\s\S]*?)(?=(?:3\.\s*Potential\s+Impacts|3\.\s*Impacts|$))/i);
    const section3Match = text.match(/(?:3\.\s*Potential\s+Impacts|3\.\s*Potential\s+Environmental|3\.\s*Impacts)[:\s-]*([\s\S]*?)(?=(?:4\.\s*Geographic\s+Impact|4\.\s*Geographic|$))/i);
    const section4Match = text.match(/(?:4\.\s*Geographic\s+Impact\s+Assessment|4\.\s*Geographic\s+Impact)[:\s-]*([\s\S]*?)(?=(?:5\.\s*Recommendations|5\.\s*Action\s+Plan|$))/i);
    const section5Match = text.match(/(?:5\.\s*Recommendations\s*&\s*Action\s+Plan|5\.\s*Recommendations)[:\s-]*([\s\S]*?)(?=(?:6\.\s*Priority\s+Actions|6\.\s*Priority|$))/i);
    const section6Match = text.match(/(?:6\.\s*Priority\s+Actions(?:\s+Matrix)?|6\.\s*Priority)[:\s-]*([\s\S]*$)/i);

    // Baseline Situation (Card 1)
    const situation = (section1Match ? section1Match[1].trim() : text).trim();

    // Data-driven risk calculation (Card 2) - strictly avoids default assumptions
    const aqi = ctx.airQuality?.usAqi != null && Number.isFinite(ctx.airQuality.usAqi) ? ctx.airQuality.usAqi : null;
    const fireCount = ctx.fires && Number.isFinite(ctx.fires.count) ? ctx.fires.count : null;
    const totalFrp = ctx.fires && Number.isFinite(ctx.fires.totalFrp) ? ctx.fires.totalFrp : null;
    const closestForest = ctx.deforestation && ctx.deforestation.length > 0 ? ctx.deforestation[0] : null;
    const forestDistanceKm = closestForest && Number.isFinite(closestForest.distanceKm) ? closestForest.distanceKm : null;

    const riskResult: EnvironmentalRiskResult = calculateEnvironmentalRisk({
      aqi,
      fireCount,
      totalFrp,
      forestDistanceKm,
    });

    const narrativeRisk =
      section2Match && section2Match[1].trim()
        ? section2Match[1].trim()
        : riskResult.score !== null
        ? `Estimated composite risk indicator evaluates to ${riskResult.score}/100 (${riskResult.level} Risk, ${riskResult.confidence} Confidence based on ${riskResult.coverage}% data coverage). ${
            riskResult.indicators.airQuality.available
              ? `Air quality is recorded at US AQI ${aqi}. `
              : 'Air quality telemetry is currently unavailable for this observation coordinate. '
          }${
            riskResult.indicators.fireActivity.available
              ? `${fireCount} thermal detections recorded within ${ctx.radiusKm} km buffer. `
              : 'Thermal fire observations unavailable. '
          }${
            closestForest
              ? `Nearest catalogued forest front is ${closestForest.name} (${closestForest.distanceKm} km away; note: geographic proximity factor, not measured tree cover loss).`
              : 'No catalogued forest disturbance fronts within surveillance buffer.'
          }`
        : 'Insufficient environmental observation data to compute composite indicator. Telemetry feeds are unavailable for this coordinate.';

    // Potential Impacts (Card 3)
    const impacts =
      section3Match && section3Match[1].trim()
        ? section3Match[1].trim()
        : aqi !== null && aqi > 100
        ? `Potential public health risk: Particulate levels exceed standard thresholds (US AQI ${aqi}). Sensitive groups (children, elderly, individuals with respiratory conditions) should minimize prolonged outdoor exposure. Note: Health impacts are potential assessments based on atmospheric readings, not verified hospital admissions.`
        : `Potential public health risk: Atmospheric particulate readings are within standard ranges. Vegetative buffers are monitored for thermal drying and desiccation stress.`;

    // Geographic Impact Assessment (Card 4)
    const geographic =
      section4Match && section4Match[1].trim()
        ? section4Match[1].trim()
        : `Spatial surveillance perimeter spans ${ctx.radiusKm} km around (${place.lat.toFixed(3)}°N, ${place.lon.toFixed(3)}°E). Airshed trajectories and particulate transport depend on local meteorological wind regimes${
            closestForest ? `, with closest monitored biome front at ${closestForest.name} (${closestForest.distanceKm} km)` : ''
          }.`;

    // Recommendations (Card 5)
    const recommendations =
      section5Match && section5Match[1].trim()
        ? section5Match[1].trim()
        : [
            aqi !== null && aqi > 100
              ? `• Identified Problem: Elevated particulate air pollution (US AQI ${aqi} — ${ctx.airQuality?.category || 'Unhealthy'}).\n  Proposed Intervention: Implement construction dust suppression, enhance mechanical road sweeping, and enforce industrial stack curtailment.\n  Responsible Agency: State Pollution Control Board & Urban Local Bodies.\n  Expected Benefit: Direct reduction in peak ambient PM2.5/PM10 exposure across populated corridors.\n  Priority: ${aqi > 150 ? 'Critical' : 'High'}.`
              : `• Identified Problem: Ongoing particulate air quality monitoring baseline.\n  Proposed Intervention: Maintain continuous ambient air quality stations and automated anomaly detection.\n  Responsible Agency: State Pollution Control Board.\n  Expected Benefit: Early warning of regional atmospheric inversion episodes.\n  Priority: Moderate.`,
            fireCount !== null && fireCount > 0
              ? `• Identified Problem: Satellite-detected thermal fire anomalies (${fireCount} active clusters within ${ctx.radiusKm} km buffer, combined FRP ${ctx.fires.totalFrp} MW).\n  Proposed Intervention: Deploy rapid forest ground patrol and local fire brigades to prevent fire spread; clear seasonal fire breaks.\n  Responsible Agency: District Forest Department & Emergency Fire Response Services.\n  Expected Benefit: Immediate containment of open biomass fires and reduction of local smoke plume dispersion.\n  Priority: ${ctx.fires.maxFrp > 50 ? 'Critical' : 'High'}.`
              : `• Identified Problem: Biomass and wildfire surveillance.\n  Proposed Intervention: Maintain satellite thermal surveillance and community agro-residue management advisories.\n  Responsible Agency: District Forest Authority & Agricultural Extension Units.\n  Expected Benefit: Prevention of dry-season ignition events and agricultural stubble burns.\n  Priority: Moderate.`,
            closestForest
              ? `• Identified Problem: Proximity to catalogued forest canopy disturbance front (${closestForest.name}, ${closestForest.distanceKm} km away; primary driver: ${closestForest.driver}).\n  Proposed Intervention: Coordinate satellite canopy boundary verification with field forest guards and community forest committees.\n  Responsible Agency: Territorial Forest Division & Wildlife Authorities.\n  Expected Benefit: Preservation of critical vegetative canopy and prevention of ecological buffer fragmentation.\n  Priority: Moderate.`
              : `• Identified Problem: Ecological corridor and forest canopy preservation.\n  Proposed Intervention: Maintain satellite forest loss surveillance across regional biomes and sensitive watersheds.\n  Responsible Agency: State Forest Department.\n  Expected Benefit: Long-term preservation of regional microclimate and biodiversity.\n  Priority: Moderate.`,
          ].join('\n\n');

    // Priority Actions (Card 6)
    const rawPriority = section6Match ? section6Match[1].trim() : '';

    return {
      situation,
      riskResult,
      narrativeRisk,
      impacts,
      geographic,
      recommendations,
      rawPriority,
    };
  }, [summary, place.lat, place.lon]);

  const isFallbackActive =
    !!summary &&
    (summary.fallback || (summary.source === 'rule-based' && summary.fallbackReason !== undefined));

  const handleCopyReport = async () => {
    if (!summary?.summary) return;
    const formatted = [
      `=== ATmosIQ AI Environmental Intelligence Brief ===`,
      `Target Location: ${place.name} (${place.lat.toFixed(4)}°N, ${place.lon.toFixed(4)}°E)`,
      `Surveillance Radius: ${radiusKm} km | Generated: ${new Date(summary.generatedAt).toLocaleString()}`,
      `Intelligence Source: ${summary.source === 'gemini' ? `Google Gemini (${summary.model || 'Multi-Model'})` : 'Rule-Based Analytical Core'}`,
      ``,
      `1. CURRENT ENVIRONMENTAL SITUATION:`,
      structuredReport?.situation || summary.summary,
      ``,
      `2. ENVIRONMENTAL RISK ASSESSMENT:`,
      structuredReport?.narrativeRisk || 'Evaluated via multi-sensor composite telemetry.',
      ``,
      `3. POTENTIAL ENVIRONMENTAL & PUBLIC HEALTH IMPACTS:`,
      structuredReport?.impacts || 'Particulate inhalation hazard and regional vegetative strain.',
      ``,
      `4. GEOGRAPHIC IMPACT ASSESSMENT:`,
      structuredReport?.geographic || `Buffer zone radius: ${radiusKm} km.`,
      ``,
      `5. RECOMMENDATIONS & ACTION PLAN:`,
      structuredReport?.recommendations || 'Active monitoring and targeted containment.',
      ``,
      `6. PRIORITY ACTIONS MATRIX:`,
      `• Immediate (0-24h): Real-time field calibration, fire containment dispatch, air quality advisories.`,
      `• Short-Term (1-7d): Satellite overpass correlation, vehicle/industry emission regulation.`,
      `• Medium-Term (1-3m): Reforestation buffers, anti-encroachment patrols, emission standards enforcement.`,
      `• Long-Term (3-12m): Inter-state airshed management compact, clean biomass alternatives, green corridor expansion.`,
    ].join('\n');

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(formatted);
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2500);
      }
    } catch {
      // Fallback
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      {/* 1. Top Control Bar: Location, Coordinates & Intelligence Generation */}
      <div className="p-4 sm:p-6 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-4 min-w-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-emerald-950/80 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
              <h2 className="text-lg sm:text-xl font-bold font-serif text-[#F2F5F2] tracking-tight">
                AI Environmental Intelligence Brief
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#9CAEA2]">
              Sovereign environmental risk synthesis grounded in NASA FIRMS, Copernicus CAMS, and Global Forest Watch.
            </p>
          </div>

          {/* Quick preset selector buttons covering Indian territory */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <span className="text-xs font-mono text-[#9CAEA2] mr-1 hidden sm:inline">Regions:</span>
            {PRESET_PLACES.slice(0, 6).map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  setSelectedPlace(p);
                  setSummary(null);
                  setError(null);
                  setShowCustomCoords(false);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  place.name === p.name
                    ? 'bg-[#174C34] text-emerald-300 border border-emerald-600/70 font-semibold'
                    : 'bg-[#14251C] text-[#9CAEA2] hover:text-[#F2F5F2] border border-emerald-900/60'
                }`}
              >
                {p.name.split(' ')[0]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowCustomCoords((prev) => !prev)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer border flex items-center gap-1 ${
                showCustomCoords
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500'
                  : 'bg-[#14251C] text-[#9CAEA2] hover:text-[#F2F5F2] border-emerald-900/60'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Custom Coords</span>
            </button>
          </div>
        </div>

        {/* Custom Coordinates Form (collapsible) */}
        {showCustomCoords && (
          <form onSubmit={handleApplyCustomCoords} className="p-4 rounded-xl bg-[#0D1914] border border-emerald-900/70 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-950/70">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                Observation Coordinates (Republic of India)
              </span>
              <span className="text-[11px] text-[#9CAEA2] font-mono">Bounds: 6.5°N–37.5°N, 68.0°E–97.5°E</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[#A8BCAE] mb-1">Target Name</label>
                <input
                  type="text"
                  placeholder="e.g. Pune Bio-Reserve"
                  value={customNameInput}
                  onChange={(e) => setCustomNameInput(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#14251C] border border-emerald-900/60 text-xs text-[#F2F5F2] focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#A8BCAE] mb-1">Latitude (°N)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 18.5204"
                  value={customLatInput}
                  onChange={(e) => setCustomLatInput(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#14251C] border border-emerald-900/60 text-xs text-[#F2F5F2] font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#A8BCAE] mb-1">Longitude (°E)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 73.8567"
                  value={customLonInput}
                  onChange={(e) => setCustomLonInput(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#14251C] border border-emerald-900/60 text-xs text-[#F2F5F2] font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {coordError && (
              <div className="text-xs text-red-300 bg-red-950/40 border border-red-900/60 rounded-lg p-2.5 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{coordError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCustomCoords(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-[#9CAEA2] hover:text-[#F2F5F2] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-[#174C34] hover:bg-[#1F6244] border border-emerald-600/70 text-xs font-semibold text-[#F2F5F2] transition-colors cursor-pointer"
              >
                Set Location & Generate
              </button>
            </div>
          </form>
        )}

        {/* Selected target display & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-5 rounded-xl bg-[#0D1914] border border-emerald-950/80 min-w-0">
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-xl bg-[#174C34]/50 border border-emerald-600/60 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold font-serif text-[#F2F5F2] truncate">{place.name}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
                  India Territorial AOI
                </span>
              </div>
              <p className="text-xs text-emerald-400 font-mono mt-0.5">
                {place.lat.toFixed(4)}°N, {place.lon.toFixed(4)}°E · {radiusKm} km Multi-Sensor Radius
              </p>
              {place.details && place.details.length > 0 && (
                <p className="text-[11px] text-[#9CAEA2] mt-1 truncate">{place.details[0]}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Radius Buffer Selector */}
            <div className="flex items-center gap-1.5 bg-[#14251C] px-3 py-1.5 rounded-xl border border-emerald-900/60">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-[#9CAEA2] font-mono">Radius:</span>
              <select
                value={radiusKm}
                onChange={(e) => {
                  const r = Number(e.target.value);
                  setRadiusKm(r);
                  if (dashboardContext?.setSelectedRadiusKm) {
                    dashboardContext.setSelectedRadiusKm(r);
                  }
                }}
                className="bg-transparent text-xs font-mono text-[#F2F5F2] focus:outline-none cursor-pointer"
                title="Select surveillance radius buffer in kilometers"
              >
                <option value={50} className="bg-[#0D1914]">50 km</option>
                <option value={100} className="bg-[#0D1914]">100 km</option>
                <option value={150} className="bg-[#0D1914]">150 km</option>
                <option value={200} className="bg-[#0D1914]">200 km</option>
                <option value={300} className="bg-[#0D1914]">300 km</option>
                <option value={500} className="bg-[#0D1914]">500 km</option>
              </select>
            </div>

            {/* Bypass cache toggle */}
            <label className="flex items-center gap-1.5 text-xs text-[#9CAEA2] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={bypassCache}
                onChange={(e) => setBypassCache(e.target.checked)}
                className="rounded border-emerald-800 bg-[#14251C] text-emerald-500 focus:ring-emerald-500/40"
              />
              <span className="font-mono text-[11px]">Bypass Cache</span>
            </label>

            <button
              type="button"
              onClick={() => handleGenerateBrief(bypassCache)}
              disabled={loading}
              className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-[#174C34] to-[#1F6244] hover:from-[#1F6244] hover:to-[#2E8B57] disabled:opacity-60 text-xs sm:text-sm font-bold text-[#F2F5F2] border border-emerald-500/60 shadow-md shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin text-emerald-300" /> : <Sparkles className="w-4 h-4 text-emerald-300" />}
              <span>{loading ? 'Synthesizing Brief…' : summary ? 'Regenerate Brief' : 'Generate AI Risk Brief'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Internal Telemetry Synchronization State (Visually hidden to give immediate priority to the intelligence brief) */}
      <div className="sr-only" aria-live="polite" data-testid="internal-telemetry-sync">
        {syncSources.map((source) => (
          <div key={source.id}>
            <span>{source.label}</span>
            <span>{source.status}</span>
            <span>{source.message}</span>
          </div>
        ))}
      </div>

      {/* 3. Error Display (only if no usable summary exists) */}
      {!summary && error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-900/60 text-xs sm:text-sm text-red-200 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* 4. Small, Unobtrusive Fallback Notice when AI service is unavailable */}
      {isFallbackActive && (
        <div
          data-testid="ai-fallback-notice"
          className="p-3.5 sm:p-4 rounded-xl bg-amber-950/40 border border-amber-900/60 text-xs sm:text-sm text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm min-w-0"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="leading-snug">
              AI service temporarily unavailable. Showing an environmental analysis based on available data.
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleGenerateBrief(true)}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-amber-900/60 hover:bg-amber-800/80 text-amber-100 border border-amber-700/60 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-300 ${loading ? 'animate-spin' : ''}`} />
            <span>Retry AI Brief</span>
          </button>
        </div>
      )}

      {/* 5. Complete 6-Section Structured Environmental Brief Output */}
      {summary ? (
        <div className="space-y-6 sm:space-y-8 min-w-0">
          {/* Metadata pill bar with Action Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl bg-[#101F18] border border-emerald-950 text-xs min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`px-2.5 py-1 rounded-md border font-semibold text-xs ${
                  summary.source === 'gemini'
                    ? 'border-emerald-600/60 bg-emerald-950/70 text-emerald-300'
                    : 'border-amber-700/60 bg-amber-950/60 text-amber-300'
                }`}
              >
                {summary.source === 'gemini'
                  ? 'Google Gemini Intelligence'
                  : summary.fallback
                  ? 'Rule-Based Analytical Brief (Fallback)'
                  : 'Rule-Based Analytical Brief'}
              </span>

              {summary.model && (
                <span className="px-2 py-0.5 rounded border border-emerald-900/70 bg-[#0D1914] text-[11px] font-mono text-emerald-400">
                  Model: {summary.model}
                </span>
              )}

              <span className="text-[#9CAEA2] font-mono">
                Active Telemetry: {summary.context.fires.count} fire detections within {summary.context.radiusKm} km
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[#82978B] font-mono text-[11px] hidden sm:inline mr-2">
                Observed: {new Date(summary.generatedAt).toLocaleTimeString()}
              </span>

              <button
                type="button"
                onClick={handleCopyReport}
                className="px-2.5 py-1.5 rounded-lg bg-[#14251C] hover:bg-[#1A3326] text-[#CBDAD0] hover:text-[#F2F5F2] border border-emerald-900/60 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Copy structured brief to clipboard"
              >
                {copiedToast ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedToast ? 'Copied!' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="px-2.5 py-1.5 rounded-lg bg-[#14251C] hover:bg-[#1A3326] text-[#CBDAD0] hover:text-[#F2F5F2] border border-emerald-900/60 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Print or export brief as PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Print</span>
              </button>
            </div>
          </div>

          {/* Grid of the 6 Structured Intelligence Report Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 min-w-0">
            {/* Card 1: Current Environmental Situation */}
            <div className="p-5 sm:p-6 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-4 min-w-0 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2.5 border-b border-emerald-950/80">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0" />
                    <h4 className="text-sm sm:text-base font-bold font-serif text-[#F2F5F2]">
                      1. Current Environmental Situation
                    </h4>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">Ground State</span>
                </div>

                <div className="text-xs sm:text-sm text-[#CBDAD0] leading-relaxed whitespace-pre-line font-medium">
                  {structuredReport?.situation || summary.summary}
                </div>
              </div>

              {/* Multi-pollutant telemetry snapshot chips */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3 border-t border-emerald-950/80 text-xs">
                <div className="p-2 rounded-lg bg-[#0D1914] border border-emerald-950/70">
                  <div className="flex items-center gap-1 text-[#9CAEA2] text-[10px] font-mono">
                    <Wind className="w-3 h-3 text-cyan-400" />
                    <span>AIR QUALITY</span>
                  </div>
                  <div className="font-bold font-mono text-[#F2F5F2] text-xs sm:text-sm mt-0.5">
                    {summary.context.airQuality?.usAqi != null ? `${summary.context.airQuality.usAqi} AQI` : 'Model Cycle'}
                  </div>
                  <div className="text-[9px] text-[#82978B] truncate">
                    {summary.context.airQuality?.category || 'Active monitoring'}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-[#0D1914] border border-emerald-950/70">
                  <div className="flex items-center gap-1 text-[#9CAEA2] text-[10px] font-mono">
                    <Flame className="w-3 h-3 text-orange-400" />
                    <span>THERMAL FIRES</span>
                  </div>
                  <div className="font-bold font-mono text-[#F2F5F2] text-xs sm:text-sm mt-0.5">
                    {summary.context.fires.count} Clusters
                  </div>
                  <div className="text-[9px] text-[#82978B] truncate">
                    Peak: {summary.context.fires.maxFrp} MW FRP
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-[#0D1914] border border-emerald-950/70">
                  <div className="flex items-center gap-1 text-[#9CAEA2] text-[10px] font-mono">
                    <TreeDeciduous className="w-3 h-3 text-purple-400" />
                    <span>FOREST CANOPY</span>
                  </div>
                  <div className="font-bold font-mono text-[#F2F5F2] text-xs sm:text-sm mt-0.5">
                    {summary.context.deforestation?.length || 0} Hotspots
                  </div>
                  <div className="text-[9px] text-[#82978B] truncate">
                    {summary.context.deforestation?.length ? `${summary.context.deforestation[0].name.slice(0, 12)}…` : 'Secure buffer'}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Environmental Risk Assessment (Data-Driven Calculation) */}
            <div className="p-5 sm:p-6 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-4 min-w-0 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2.5 border-b border-emerald-950/80">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
                    <h4 className="text-sm sm:text-base font-bold font-serif text-[#F2F5F2]">
                      2. Environmental Risk Assessment
                    </h4>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${
                      structuredReport?.riskResult.level === 'Critical'
                        ? 'bg-red-950/80 text-red-300 border-red-800'
                        : structuredReport?.riskResult.level === 'High'
                        ? 'bg-orange-950/80 text-orange-300 border-orange-800'
                        : structuredReport?.riskResult.level === 'Moderate'
                        ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                        : structuredReport?.riskResult.level === 'Low'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                        : 'bg-zinc-800/80 text-zinc-300 border-zinc-700'
                    }`}
                  >
                    {structuredReport?.riskResult.level || 'Low'} Risk
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold font-mono text-[#F2F5F2]">
                    {structuredReport?.riskResult.score !== null ? structuredReport?.riskResult.score : 'N/A'}
                  </span>
                  <span className="text-sm font-mono text-[#9CAEA2]">/ 100 Estimated Composite Indicator</span>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-mono text-[#A8BCAE]">
                  <span>Data Coverage: {structuredReport?.riskResult.coverage ?? 0}%</span>
                  <span>•</span>
                  <span>Confidence: {structuredReport?.riskResult.confidence ?? 'Low'}</span>
                </div>

                <p className="text-xs sm:text-sm text-[#CBDAD0] leading-relaxed">
                  {structuredReport?.narrativeRisk}
                </p>
              </div>

              {/* Data-Driven Indicator Breakdown */}
              <div className="space-y-2 pt-3 border-t border-emerald-950/80 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#9CAEA2]">Air Quality Contribution (weight 40%)</span>
                  <span className="font-mono text-[#F2F5F2] font-semibold">
                    {structuredReport?.riskResult.indicators.airQuality.available
                      ? `${Math.round(structuredReport.riskResult.indicators.airQuality.score)}/100`
                      : 'Unavailable'}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-emerald-950 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 rounded-full"
                    style={{
                      width: structuredReport?.riskResult.indicators.airQuality.available
                        ? `${structuredReport.riskResult.indicators.airQuality.score}%`
                        : '0%',
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-[#9CAEA2]">Fire Activity Contribution (weight 35%)</span>
                  <span className="font-mono text-[#F2F5F2] font-semibold">
                    {structuredReport?.riskResult.indicators.fireActivity.available
                      ? `${Math.round(structuredReport.riskResult.indicators.fireActivity.score)}/100`
                      : 'Unavailable'}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-emerald-950 overflow-hidden">
                  <div
                    className="h-full bg-orange-400 rounded-full"
                    style={{
                      width: structuredReport?.riskResult.indicators.fireActivity.available
                        ? `${structuredReport.riskResult.indicators.fireActivity.score}%`
                        : '0%',
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-[#9CAEA2]">Forest Proximity Factor (weight 25%)</span>
                  <span className="font-mono text-[#F2F5F2] font-semibold">
                    {structuredReport?.riskResult.indicators.forestLoss.available
                      ? `${Math.round(structuredReport.riskResult.indicators.forestLoss.score)}/100`
                      : 'No front in 150 km'}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-emerald-950 overflow-hidden">
                  <div
                    className="h-full bg-purple-400 rounded-full"
                    style={{
                      width: structuredReport?.riskResult.indicators.forestLoss.available
                        ? `${structuredReport.riskResult.indicators.forestLoss.score}%`
                        : '0%',
                    }}
                  />
                </div>

                <p className="text-[10px] text-[#82978B] pt-1 italic">
                  Note: Composite indicator reflects available observation feeds; not an official government index. Missing data contributes 0 weight.
                </p>
              </div>
            </div>

            {/* Card 3: Potential Environmental & Public Health Impacts */}
            <div className="p-5 sm:p-6 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-4 min-w-0">
              <div className="flex items-center justify-between pb-2.5 border-b border-emerald-950/80">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <h4 className="text-sm sm:text-base font-bold font-serif text-[#F2F5F2]">
                    3. Potential Impacts
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-amber-400 uppercase tracking-wider">Demographic Strain</span>
              </div>

              <div className="text-xs sm:text-sm text-[#CBDAD0] leading-relaxed whitespace-pre-line">
                {structuredReport?.impacts}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs">
                <div className="p-2.5 rounded-lg bg-[#0D1914] border border-emerald-950/70 space-y-1">
                  <span className="text-[10px] font-semibold text-amber-300 font-mono block">SENSITIVE POPULATIONS</span>
                  <p className="text-[11px] text-[#A8BCAE] leading-snug">
                    Children, senior citizens, and patients with asthma or COPD require immediate particulate exposure limits.
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-[#0D1914] border border-emerald-950/70 space-y-1">
                  <span className="text-[10px] font-semibold text-emerald-400 font-mono block">ECOLOGICAL EQUILIBRIUM</span>
                  <p className="text-[11px] text-[#A8BCAE] leading-snug">
                    Vegetative desiccating stress and particulate settling onto photosynthetic surfaces across local canopies.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 4: Geographic Impact Assessment */}
            <div className="p-5 sm:p-6 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-4 min-w-0">
              <div className="flex items-center justify-between pb-2.5 border-b border-emerald-950/80">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
                  <h4 className="text-sm sm:text-base font-bold font-serif text-[#F2F5F2]">
                    4. Geographic Impact Assessment
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">Spatial Trajectory</span>
              </div>

              <div className="text-xs sm:text-sm text-[#CBDAD0] leading-relaxed whitespace-pre-line">
                {structuredReport?.geographic}
              </div>

              <div className="p-3 rounded-lg bg-[#0D1914] border border-emerald-950/70 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-emerald-400">Buffer Radius:</span>
                  <span className="text-[#F2F5F2] font-bold">{summary.context.radiusKm} km Perimeter</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-emerald-400">Target Coordinates:</span>
                  <span className="text-[#F2F5F2]">{place.lat.toFixed(4)}°N, {place.lon.toFixed(4)}°E</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-emerald-400">Jurisdiction:</span>
                  <span className="text-[#F2F5F2]">Republic of India Airshed Protocol</span>
                </div>
              </div>
            </div>

            {/* Card 5: Recommendations & Action Plan */}
            <div className="p-5 sm:p-6 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-4 min-w-0">
              <div className="flex items-center justify-between pb-2.5 border-b border-emerald-950/80">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <h4 className="text-sm sm:text-base font-bold font-serif text-[#F2F5F2]">
                    5. Recommendations & Action Plan
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">Mitigation Plan</span>
              </div>

              <div className="text-xs sm:text-sm text-[#CBDAD0] leading-relaxed whitespace-pre-line">
                {structuredReport?.recommendations}
              </div>

              <ul className="space-y-2 pt-1 text-xs text-[#CBDAD0]">
                <li className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Enforce dynamic emission curtailment on industrial units within active stagnation perimeters.</span>
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Deploy rapid ground verification teams to extinguish identified high-power thermal clusters.</span>
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Maintain public alerts across educational institutions and vulnerable civic zones.</span>
                </li>
              </ul>
            </div>

            {/* Card 6: Priority Actions Matrix (Time-Phased Operations) */}
            <div className="p-5 sm:p-6 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-4 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-emerald-950/80">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                  <h4 className="text-sm sm:text-base font-bold font-serif text-[#F2F5F2]">
                    6. Priority Actions Matrix
                  </h4>
                </div>

                {/* Horizon filter tabs */}
                <div className="flex items-center gap-1">
                  {(['all', 'immediate', 'short', 'medium', 'long'] as const).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setSelectedHorizon(h)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors cursor-pointer capitalize ${
                        selectedHorizon === h
                          ? 'bg-[#174C34] text-emerald-300 border border-emerald-600/70'
                          : 'bg-[#14251C] text-[#9CAEA2] hover:text-[#F2F5F2] border border-emerald-950'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority Action Horizons Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {(selectedHorizon === 'all' || selectedHorizon === 'immediate') && (
                  <div className="p-3 rounded-lg bg-[#0D1914] border border-red-900/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-red-400 uppercase">Immediate</span>
                      <span className="text-[9px] font-mono text-[#9CAEA2]">0 – 24 Hours</span>
                    </div>
                    <p className="text-[11px] text-[#CBDAD0] leading-snug">
                      Activate municipal health alerts, dispatch rapid fire-response patrols, and calibrate ground sensor grids.
                    </p>
                  </div>
                )}

                {(selectedHorizon === 'all' || selectedHorizon === 'short') && (
                  <div className="p-3 rounded-lg bg-[#0D1914] border border-orange-900/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-orange-400 uppercase">Short-Term</span>
                      <span className="text-[9px] font-mono text-[#9CAEA2]">1 – 7 Days</span>
                    </div>
                    <p className="text-[11px] text-[#CBDAD0] leading-snug">
                      Schedule satellite tracking overpasses, enact temporary construction bans, and mobilize ambient air vans.
                    </p>
                  </div>
                )}

                {(selectedHorizon === 'all' || selectedHorizon === 'medium') && (
                  <div className="p-3 rounded-lg bg-[#0D1914] border border-amber-900/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-amber-400 uppercase">Medium-Term</span>
                      <span className="text-[9px] font-mono text-[#9CAEA2]">1 – 3 Months</span>
                    </div>
                    <p className="text-[11px] text-[#CBDAD0] leading-snug">
                      Conduct forest anti-encroachment sweeps, review industrial chimney compliance, and establish ecological buffer zones.
                    </p>
                  </div>
                )}

                {(selectedHorizon === 'all' || selectedHorizon === 'long') && (
                  <div className="p-3 rounded-lg bg-[#0D1914] border border-emerald-900/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">Long-Term</span>
                      <span className="text-[9px] font-mono text-[#9CAEA2]">3 – 12 Months</span>
                    </div>
                    <p className="text-[11px] text-[#CBDAD0] leading-snug">
                      Establish cross-state airshed management compacts, subsidize crop biomass conversion, and plant regional green barriers.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Operational Notice and Analytical Projection Grounding */}
          <div className="p-4 rounded-xl bg-[#101F18] border border-emerald-950 flex items-start gap-3 text-xs text-[#9CAEA2]">
            <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-[#CBDAD0]">Operational Notice:</span>{' '}
              <span>
                All impacts are analytical projections grounded in available telemetry, not confirmed real-world emergencies.
                Telemetry Coverage reflects active data availability across monitored environmental indicators.
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-10 sm:p-14 rounded-xl bg-[#101F18] border border-dashed border-emerald-950/80 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-[#14251C] border border-emerald-800/60 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <h3 className="text-base sm:text-lg font-bold font-serif text-[#F2F5F2]">
            Ready to Synthesize Environmental Brief
          </h3>
          <p className="text-xs sm:text-sm text-[#9CAEA2] max-w-md mx-auto">
            Click "Generate AI Risk Brief" above to trigger real-time multi-source environmental telemetry synchronization (NASA FIRMS, Copernicus CAMS, and Global Forest Watch) for {place.name}.
          </p>
        </div>
      )}
    </div>
  );
};

export default AiBriefPage;
