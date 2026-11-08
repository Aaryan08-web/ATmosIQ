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
export interface FireResult { points: FirePoint[]; total: number; source: string; live: boolean; fetchedAt: string; }
export interface AqPoint { name: string; country: string; lat: number; lon: number; usAqi: number | null; pm25: number | null; pm10: number | null; category: string; time: string | null; }
export interface AqResult { points: AqPoint[]; source: string; live: boolean; fetchedAt: string; }
export interface DeforestationHotspot { id: string; name: string; country: string; lat: number; lon: number; biome: string; driver: string; severity: 'Critical' | 'High' | 'Moderate'; }
export interface DeforestationResult { points: DeforestationHotspot[]; source: string; live: boolean; fetchedAt: string; }
export interface Overview {
  fires: { total: number; shown: number; live: boolean; source: string; fetchedAt: string };
  airQuality: { stations: number; unhealthy: number; worst: { name: string; country: string; usAqi: number | null; category: string } | null; available: boolean; fetchedAt: string | null };
  deforestation: { hotspots: number; live: boolean };
}
export interface AiSummary {
  summary: string;
  source: 'gemini' | 'rule-based';
  generatedAt: string;
  context: { fires: { count: number; totalFrp: number; maxFrp: number; live: boolean }; radiusKm: number };
}
export interface SelectedPlace { name: string; lat: number; lon: number; kind: 'fire' | 'air' | 'forest' | 'point'; details: string[]; }
