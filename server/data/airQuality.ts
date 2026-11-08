import { cached } from './cache.js';

export interface AqPoint {
  name: string;
  country: string;
  lat: number;
  lon: number;
  usAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  category: string;
  time: string | null;
}

export interface AqResult {
  points: AqPoint[];
  source: string;
  live: boolean;
  fetchedAt: string;
}

// Monitoring points: major cities, weighted toward India and fire/deforestation regions.
const CITIES: [string, string, number, number][] = [
  ['Delhi', 'India', 28.61, 77.21], ['Mumbai', 'India', 19.08, 72.88], ['Pune', 'India', 18.52, 73.86],
  ['Kolkata', 'India', 22.57, 88.36], ['Chennai', 'India', 13.08, 80.27], ['Bengaluru', 'India', 12.97, 77.59],
  ['Hyderabad', 'India', 17.39, 78.49], ['Lucknow', 'India', 26.85, 80.95], ['Ahmedabad', 'India', 23.02, 72.57],
  ['Patna', 'India', 25.59, 85.14], ['Amritsar', 'India', 31.63, 74.87], ['Dhaka', 'Bangladesh', 23.81, 90.41],
  ['Lahore', 'Pakistan', 31.55, 74.34], ['Kathmandu', 'Nepal', 27.72, 85.32], ['Beijing', 'China', 39.9, 116.4],
  ['Shanghai', 'China', 31.23, 121.47], ['Bangkok', 'Thailand', 13.76, 100.5], ['Jakarta', 'Indonesia', -6.21, 106.85],
  ['Palangka Raya', 'Indonesia', -2.21, 113.92], ['Tokyo', 'Japan', 35.68, 139.69], ['Seoul', 'South Korea', 37.57, 126.98],
  ['Dubai', 'UAE', 25.2, 55.27], ['Cairo', 'Egypt', 30.04, 31.24], ['Lagos', 'Nigeria', 6.52, 3.38],
  ['Kinshasa', 'DR Congo', -4.44, 15.27], ['Nairobi', 'Kenya', -1.29, 36.82], ['Johannesburg', 'South Africa', -26.2, 28.05],
  ['Moscow', 'Russia', 55.76, 37.62], ['Istanbul', 'Turkey', 41.01, 28.98], ['London', 'UK', 51.51, -0.13],
  ['Paris', 'France', 48.86, 2.35], ['Berlin', 'Germany', 52.52, 13.4], ['Madrid', 'Spain', 40.42, -3.7],
  ['Sydney', 'Australia', -33.87, 151.21], ['Canberra', 'Australia', -35.28, 149.13], ['Los Angeles', 'USA', 34.05, -118.24],
  ['New York', 'USA', 40.71, -74.0], ['Mexico City', 'Mexico', 19.43, -99.13], ['Bogotá', 'Colombia', 4.71, -74.07],
  ['Lima', 'Peru', -12.05, -77.04], ['Manaus', 'Brazil', -3.12, -60.02], ['Porto Velho', 'Brazil', -8.76, -63.9],
  ['São Paulo', 'Brazil', -23.55, -46.63], ['Santa Cruz', 'Bolivia', -17.78, -63.18], ['Santiago', 'Chile', -33.45, -70.67],
];

export function aqiCategory(aqi: number | null): string {
  if (aqi == null) return 'Unknown';
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for sensitive groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very unhealthy';
  return 'Hazardous';
}

async function loadAirQuality(): Promise<AqResult> {
  const lats = CITIES.map((c) => c[2]).join(',');
  const lons = CITIES.map((c) => c[3]).join(',');
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}` +
    `&current=us_aqi,pm2_5,pm10&timezone=GMT`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  const json = (await res.json()) as unknown;
  const arr = (Array.isArray(json) ? json : [json]) as {
    current?: { time?: string; us_aqi?: number | null; pm2_5?: number | null; pm10?: number | null };
  }[];
  const points: AqPoint[] = CITIES.map((c, i) => {
    const cur = arr[i]?.current;
    const usAqi = cur?.us_aqi ?? null;
    return {
      name: c[0], country: c[1], lat: c[2], lon: c[3],
      usAqi, pm25: cur?.pm2_5 ?? null, pm10: cur?.pm10 ?? null,
      category: aqiCategory(usAqi), time: cur?.time ?? null,
    };
  });
  return {
    points,
    source: 'Open-Meteo Air Quality (CAMS model)',
    live: true,
    fetchedAt: new Date().toISOString(),
  };
}

export function getAirQuality(): Promise<AqResult> {
  return cached('aq', 30 * 60 * 1000, loadAirQuality);
}
