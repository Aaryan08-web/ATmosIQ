export interface User {
  id: string;
  name: string;
  email: string;
  organization?: string;
  role: 'admin' | 'analyst' | 'researcher' | 'observer';
  avatarInitials: string;
  createdAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignupCredentials {
  name: string;
  email: string;
  organization?: string;
  password: string;
  confirmPassword: string;
  agreeToTerms?: boolean;
}

// ---- Live data (API) ----
export interface FirePoint { lat: number; lon: number; frp: number; confidence: string; acquired: string; satellite: string; daynight: string; }
export interface FireResult {
  points: FirePoint[];
  total: number;
  source: string;
  live: boolean;
  isDemo?: boolean;
  status?: 'live' | 'sample';
  fetchedAt: string;
  bbox?: [number, number, number, number] | null;
}
export interface AqPoint {
  name: string;
  state?: string;
  country: string;
  lat: number;
  lon: number;
  usAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  no2?: number | null;
  so2?: number | null;
  co?: number | null;
  o3?: number | null;
  category: string;
  time: string | null;
}
export interface AqPointResult {
  point: AqPoint;
  source: string;
  live: boolean;
  fetchedAt: string;
  metadata?: {
    provider: string;
    model: string;
    type: string;
    variables: Record<string, { label: string; unit: string }>;
  };
}
export interface AqResult { points: AqPoint[]; source: string; live: boolean; fetchedAt: string; }
export interface DeforestationHotspot { id: string; name: string; state?: string; country: string; lat: number; lon: number; biome: string; driver: string; severity: 'Critical' | 'High' | 'Moderate'; type?: 'reference'; }

export interface GfwForestAlert {
  id: string;
  alert_id: string;
  dataset: string;
  version: string;
  latitude: number;
  longitude: number;
  area_ha: number | null;
  confidence: 'high' | 'nominal' | 'low';
  alert_date: string;
  location_name: string | null;
  source: string;
  retrieved_at: string;
}

export interface GfwSyncStatus {
  id: string;
  last_attempt_at: string;
  last_success_at: string | null;
  status: 'idle' | 'running' | 'success' | 'failed' | 'unauthorized' | 'unavailable';
  records_ingested: number;
  error_message: string | null;
}

export interface ForestCategoriesSummary {
  liveAlertsCount: number;
  curatedReservesCount: number;
  historicalBenchmarksAvailable: boolean;
  hasDemoData: boolean;
}

export interface ForestMetadata {
  datasetName: string;
  coverage: string;
  observationPeriod: string;
  source: string;
  lastSync: string | null;
  status: string;
}

export interface MonitoredForestAoi {
  id: string;
  name: string;
  state: string;
  geometry: {
    type: 'Polygon';
    coordinates: [number, number][][];
  };
}

export interface DeforestationResult {
  points: DeforestationHotspot[];
  referencePoints?: DeforestationHotspot[];
  curatedReserves?: DeforestationHotspot[];
  monitoredAois?: MonitoredForestAoi[];
  liveAlerts?: GfwForestAlert[];
  syncStatus?: GfwSyncStatus;
  categories?: ForestCategoriesSummary;
  metadata?: ForestMetadata;
  unmonitoredNotice?: string;
  source: string;
  live: boolean;
  fetchedAt: string;
}

export interface EnvironmentalSnapshot {
  id: string;
  timestamp: string;
  fire_count: number;
  unhealthy_aqi_count: number;
  worst_aqi: number | null;
  worst_city: string | null;
  total_frp: number | null;
  created_at: number;
}

export interface HistoryResult {
  snapshots: EnvironmentalSnapshot[];
  count: number;
}
export interface Overview {
  fires: { total: number; shown: number; live: boolean; source: string; fetchedAt: string };
  airQuality: {
    stations: number;
    virtualObservatories?: number;
    unhealthy: number;
    worst: { name: string; country: string; usAqi: number | null; category: string } | null;
    available: boolean;
    fetchedAt: string | null;
    modelled?: boolean;
    type?: string;
  };
  deforestation: {
    hotspots: number;
    curatedReserves?: number;
    liveAlerts?: number;
    live: boolean;
    status?: string;
  };
}
export interface AiSummaryTiming {
  dataRetrievalMs: number;
  geminiMs: number;
  backoffMs: number;
  fallbackMs: number;
  totalMs: number;
  cached: boolean;
}

export interface AiSummaryContext {
  name?: string;
  lat?: number;
  lon?: number;
  radiusKm: number;
  fires: { count: number; totalFrp: number; maxFrp: number; live: boolean };
  airQualityStatus?: string;
  airQuality?: { station: string; distanceKm: number; usAqi: number | null; pm25?: number; category: string } | null;
  deforestation?: Array<{ name: string; distanceKm: number; driver: string; severity?: string }>;
}

export interface AiSummary {
  summary: string;
  source: 'gemini' | 'rule-based';
  fallback?: boolean;
  fallbackReason?: string;
  model?: string;
  generatedAt: string;
  context: AiSummaryContext;
  timing?: AiSummaryTiming;
  cacheKey?: string;
}
export interface SelectedPlace { name: string; lat: number; lon: number; kind: 'fire' | 'air' | 'forest' | 'point'; details: string[]; }
