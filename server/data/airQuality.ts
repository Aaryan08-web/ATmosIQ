import { cached } from './cache.js';
import { validateIndiaCoordinate } from './geo.js';

export interface AqPoint {
  name: string;
  state: string;
  country: string;
  lat: number;
  lon: number;
  usAqi: number | null;
  pm25: number | null; // µg/m³
  pm10: number | null; // µg/m³
  no2: number | null; // µg/m³ (Nitrogen Dioxide)
  so2: number | null; // µg/m³ (Sulphur Dioxide)
  co: number | null; // µg/m³ (Carbon Monoxide)
  o3: number | null; // µg/m³ (Ozone)
  category: string;
  time: string | null;
}

export interface AqMetadata {
  provider: string;
  model: string;
  type: string;
  coverage: string;
  variables: Record<string, { label: string; unit: string; description: string }>;
}

export interface AqResult {
  points: AqPoint[];
  source: string;
  live: boolean;
  fetchedAt: string;
  metadata?: AqMetadata;
}

export interface AqPointResult {
  point: AqPoint;
  source: string;
  live: boolean;
  fetchedAt: string;
  metadata: AqMetadata;
}

export const CAMS_METADATA: AqMetadata = {
  provider: 'Copernicus Atmosphere Monitoring Service (CAMS) / Open-Meteo API',
  model: 'ECMWF Integrated Forecasting System (IFS) Global Atmospheric Composition (0.4° resolution)',
  type: 'Atmospheric composition model simulation / reanalysis (not an in-situ ground station sensor)',
  coverage: 'Republic of India — 28 States & 8 Union Territories',
  variables: {
    usAqi: {
      label: 'United States Air Quality Index',
      unit: 'AQI (0-500)',
      description: 'Standard multi-pollutant aggregate index based on dominant breakpoint',
    },
    pm25: {
      label: 'Particulate Matter < 2.5 µm',
      unit: 'µg/m³',
      description: 'Fine inhalable combustion particles',
    },
    pm10: {
      label: 'Particulate Matter < 10 µm',
      unit: 'µg/m³',
      description: 'Inhalable coarse particulate matter (dust, crustal particles)',
    },
    no2: {
      label: 'Nitrogen Dioxide',
      unit: 'µg/m³',
      description: 'Traffic and thermal power station emissions',
    },
    so2: {
      label: 'Sulphur Dioxide',
      unit: 'µg/m³',
      description: 'Industrial combustion and fossil fuel emission tracer',
    },
    co: {
      label: 'Carbon Monoxide',
      unit: 'µg/m³',
      description: 'Incomplete combustion byproduct',
    },
    o3: {
      label: 'Tropospheric Ozone',
      unit: 'µg/m³',
      description: 'Photochemical secondary oxidant',
    },
  },
};

/**
 * Authoritative Catalog of Indian Environmental Observatories
 * Covers all 28 Indian States and 8 Union Territories with exact coordinates.
 * Format: [CityName, StateOrUT, Latitude, Longitude]
 */
export const INDIAN_CITIES: [string, string, number, number][] = [
  // Northern India
  ['Delhi NCR', 'Delhi', 28.6139, 77.2090],
  ['Noida', 'Uttar Pradesh', 28.5355, 77.3910],
  ['Lucknow', 'Uttar Pradesh', 26.8467, 80.9462],
  ['Kanpur', 'Uttar Pradesh', 26.4499, 80.3319],
  ['Varanasi', 'Uttar Pradesh', 25.3176, 82.9739],
  ['Chandigarh', 'Chandigarh', 30.7333, 76.7794],
  ['Amritsar', 'Punjab', 31.6340, 74.8723],
  ['Ludhiana', 'Punjab', 30.9010, 75.8573],
  ['Gurugram', 'Haryana', 28.4595, 77.0266],
  ['Faridabad', 'Haryana', 28.4089, 77.3178],
  ['Jaipur', 'Rajasthan', 26.9124, 75.7873],
  ['Jodhpur', 'Rajasthan', 26.2389, 73.0243],
  ['Shimla', 'Himachal Pradesh', 31.1048, 77.1734],
  ['Dharamshala', 'Himachal Pradesh', 32.2190, 76.3234],
  ['Dehradun', 'Uttarakhand', 30.3165, 78.0322],
  ['Haridwar', 'Uttarakhand', 29.9457, 78.1642],
  ['Srinagar', 'Jammu & Kashmir', 34.0837, 74.7973],
  ['Jammu', 'Jammu & Kashmir', 32.7266, 74.8570],
  ['Leh', 'Ladakh', 34.1526, 77.5771],

  // Western India
  ['Mumbai', 'Maharashtra', 19.0760, 72.8777],
  ['Pune', 'Maharashtra', 18.5204, 73.8567],
  ['Nagpur', 'Maharashtra', 21.1458, 79.0882],
  ['Ahmedabad', 'Gujarat', 23.0225, 72.5714],
  ['Surat', 'Gujarat', 21.1702, 72.8311],
  ['Panaji', 'Goa', 15.4909, 73.8278],
  ['Daman', 'DNHDD', 20.3974, 72.8328],

  // Central India
  ['Bhopal', 'Madhya Pradesh', 23.2599, 77.4126],
  ['Indore', 'Madhya Pradesh', 22.7196, 75.8577],
  ['Raipur', 'Chhattisgarh', 21.2514, 81.6296],

  // Eastern & Northeast India
  ['Kolkata', 'West Bengal', 22.5726, 88.3639],
  ['Siliguri', 'West Bengal', 26.7271, 88.3953],
  ['Patna', 'Bihar', 25.5941, 85.1376],
  ['Gaya', 'Bihar', 24.7914, 85.0002],
  ['Ranchi', 'Jharkhand', 23.3441, 85.3096],
  ['Jamshedpur', 'Jharkhand', 22.8046, 86.2029],
  ['Bhubaneswar', 'Odisha', 20.2961, 85.8245],
  ['Rourkela', 'Odisha', 22.2604, 84.8536],
  ['Guwahati', 'Assam', 26.1445, 91.7362],
  ['Itanagar', 'Arunachal Pradesh', 27.0844, 93.6053],
  ['Imphal', 'Manipur', 24.8170, 93.9368],
  ['Shillong', 'Meghalaya', 25.5788, 91.8933],
  ['Aizawl', 'Mizoram', 23.7271, 92.7176],
  ['Kohima', 'Nagaland', 25.6751, 94.1086],
  ['Gangtok', 'Sikkim', 27.3389, 88.6065],
  ['Agartala', 'Tripura', 23.8315, 91.2868],

  // Southern India & Islands
  ['Bengaluru', 'Karnataka', 12.9716, 77.5946],
  ['Mysuru', 'Karnataka', 12.2958, 76.6394],
  ['Hyderabad', 'Telangana', 17.3850, 78.4867],
  ['Warangal', 'Telangana', 17.9689, 79.5941],
  ['Chennai', 'Tamil Nadu', 13.0827, 80.2707],
  ['Coimbatore', 'Tamil Nadu', 11.0168, 76.9558],
  ['Amaravati', 'Andhra Pradesh', 16.5417, 80.5158],
  ['Visakhapatnam', 'Andhra Pradesh', 17.6868, 83.2185],
  ['Kochi', 'Kerala', 9.9312, 76.2673],
  ['Thiruvananthapuram', 'Kerala', 8.5241, 76.9366],
  ['Puducherry', 'Puducherry', 11.9416, 79.8083],
  ['Port Blair', 'Andaman & Nicobar', 11.6234, 92.7265],
  ['Kavaratti', 'Lakshadweep', 10.5667, 72.6417],
];

// Alias for backwards compatibility
export const CITIES = INDIAN_CITIES;

export function aqiCategory(aqi: number | null): string {
  if (aqi == null) return 'Unknown';
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for sensitive groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very unhealthy';
  return 'Hazardous';
}

const VARIABLES = 'us_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,ozone';

async function loadAirQuality(): Promise<AqResult> {
  const lats = INDIAN_CITIES.map((c) => c[2]).join(',');
  const lons = INDIAN_CITIES.map((c) => c[3]).join(',');
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}` +
    `&current=${VARIABLES}&timezone=GMT`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  const json = (await res.json()) as unknown;
  const arr = (Array.isArray(json) ? json : [json]) as {
    current?: {
      time?: string;
      us_aqi?: number | null;
      pm2_5?: number | null;
      pm10?: number | null;
      nitrogen_dioxide?: number | null;
      sulphur_dioxide?: number | null;
      carbon_monoxide?: number | null;
      ozone?: number | null;
    };
  }[];

  const points: AqPoint[] = arr.map((item, i) => {
    const cur = item.current ?? {};
    const aqi = cur.us_aqi != null ? Math.round(cur.us_aqi) : null;
    const [name, state, lat, lon] = INDIAN_CITIES[i];
    return {
      name,
      state,
      country: 'India',
      lat,
      lon,
      usAqi: aqi,
      pm25: cur.pm2_5 != null ? Math.round(cur.pm2_5 * 10) / 10 : null,
      pm10: cur.pm10 != null ? Math.round(cur.pm10 * 10) / 10 : null,
      no2: cur.nitrogen_dioxide != null ? Math.round(cur.nitrogen_dioxide * 10) / 10 : null,
      so2: cur.sulphur_dioxide != null ? Math.round(cur.sulphur_dioxide * 10) / 10 : null,
      co: cur.carbon_monoxide != null ? Math.round(cur.carbon_monoxide * 10) / 10 : null,
      o3: cur.ozone != null ? Math.round(cur.ozone * 10) / 10 : null,
      category: aqiCategory(aqi),
      time: cur.time ?? null,
    };
  });

  return {
    points,
    source: 'Copernicus Atmospheric Service (CAMS) / Open-Meteo',
    live: true,
    fetchedAt: new Date().toISOString(),
    metadata: CAMS_METADATA,
  };
}

/**
 * Retrieves synchronous multi-pollutant atmospheric telemetry for an arbitrary coordinate
 * strictly bounded within the sovereign territory of the Republic of India.
 */
async function loadAirQualityPoint(lat: number, lon: number, customName?: string): Promise<AqPointResult> {
  // Validate coordinate is strictly within India
  validateIndiaCoordinate(lat, lon);

  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&current=${VARIABLES}&timezone=GMT`;

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    throw new Error(`Open-Meteo atmospheric API responded with HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    current?: {
      time?: string;
      us_aqi?: number | null;
      pm2_5?: number | null;
      pm10?: number | null;
      nitrogen_dioxide?: number | null;
      sulphur_dioxide?: number | null;
      carbon_monoxide?: number | null;
      ozone?: number | null;
    };
  };

  const cur = json.current ?? {};
  const aqi = cur.us_aqi != null ? Math.round(cur.us_aqi) : null;

  const point: AqPoint = {
    name: customName || `Indian Coordinate Observatory (${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E)`,
    state: 'India',
    country: 'India',
    lat,
    lon,
    usAqi: aqi,
    pm25: cur.pm2_5 != null ? Math.round(cur.pm2_5 * 10) / 10 : null,
    pm10: cur.pm10 != null ? Math.round(cur.pm10 * 10) / 10 : null,
    no2: cur.nitrogen_dioxide != null ? Math.round(cur.nitrogen_dioxide * 10) / 10 : null,
    so2: cur.sulphur_dioxide != null ? Math.round(cur.sulphur_dioxide * 10) / 10 : null,
    co: cur.carbon_monoxide != null ? Math.round(cur.carbon_monoxide * 10) / 10 : null,
    o3: cur.ozone != null ? Math.round(cur.ozone * 10) / 10 : null,
    category: aqiCategory(aqi),
    time: cur.time ?? null,
  };

  return {
    point,
    source: 'Copernicus Atmospheric Service (CAMS) / Open-Meteo',
    live: true,
    fetchedAt: new Date().toISOString(),
    metadata: CAMS_METADATA,
  };
}

export function getAirQuality(): Promise<AqResult> {
  return cached('air_quality:india_all', 10 * 60 * 1000, loadAirQuality);
}

export function getAirQualityPoint(lat: number, lon: number, customName?: string): Promise<AqPointResult> {
  const cacheKey = `air_quality:india_point:${lat.toFixed(3)}:${lon.toFixed(3)}`;
  return cached(cacheKey, 10 * 60 * 1000, () => loadAirQualityPoint(lat, lon, customName));
}
