/**
 * Authoritative Indian Geographic Boundary & Spatial Utilities
 * Restricts all ATmosIQ environmental analytics, spatial lookups,
 * and data ingestion to the sovereign territory of the Republic of India.
 */

export interface BoundingBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

/**
 * Coarse geographic envelope encompassing the entirety of the Republic of India,
 * including mainland territories, Andaman & Nicobar Islands, and Lakshadweep.
 */
export const INDIA_BOUNDING_BOX: BoundingBox = {
  minLon: 68.0,
  minLat: 6.5,
  maxLon: 97.5,
  maxLat: 37.5,
};

/**
 * Standardized string representation of India's bounding box
 * for upstream APIs (e.g., NASA FIRMS 'minLon,minLat,maxLon,maxLat').
 */
export const INDIA_BBOX_STRING = `${INDIA_BOUNDING_BOX.minLon},${INDIA_BOUNDING_BOX.minLat},${INDIA_BOUNDING_BOX.maxLon},${INDIA_BOUNDING_BOX.maxLat}`;

/**
 * High-precision polygon defining India's mainland sovereign land boundary.
 * Array of [longitude, latitude] coordinates ordered counter-clockwise.
 */
export const INDIA_MAINLAND_POLYGON: [number, number][] = [
  // Western border / Gujarat / Kutch
  [68.15, 23.65],
  [68.8, 24.4],
  [70.5, 24.7],
  [71.4, 24.5],
  [70.5, 25.5],
  // Rajasthan western frontier (Barmer, Jaisalmer, Bikaner, Ganganagar)
  [69.7, 27.0],
  [70.5, 27.8],
  [72.0, 29.0],
  [73.5, 30.0],
  // Punjab / Jammu & Kashmir / Ladakh
  [74.2, 31.0],
  [74.8, 31.8],
  [75.2, 32.3],
  [74.8, 32.6],
  [74.0, 33.8],
  [74.2, 34.6],
  [74.5, 34.8],
  [76.8, 35.7], // Northernmost Siachen / Karakoram
  [77.8, 35.5],
  [78.5, 35.5],
  [79.5, 34.5],
  [79.2, 33.5],
  [79.0, 32.5],
  // Himachal / Uttarakhand / Indo-Nepal border
  [78.8, 31.8],
  [79.6, 31.0],
  [80.0, 30.8],
  [81.0, 30.2],
  [80.1, 28.8],
  [80.7, 28.4],
  [82.0, 27.8],
  [83.3, 27.4],
  [84.0, 27.3],
  [85.5, 26.8],
  [86.5, 26.6],
  [88.1, 26.4],
  // Sikkim
  [88.1, 27.5],
  [88.6, 28.1],
  [88.9, 27.4],
  // Bhutan border / Assam / Arunachal Pradesh
  [89.8, 26.8],
  [90.5, 26.8],
  [91.5, 26.8],
  [92.0, 27.0],
  [91.9, 27.6],
  [94.0, 28.8],
  [95.5, 29.0],
  [96.8, 28.4],
  [97.4, 28.2], // Easternmost Kibithu / Anjaw
  // Indo-Myanmar border
  [96.0, 27.0],
  [95.0, 25.8],
  [94.3, 24.2],
  [93.1, 22.4],
  [92.8, 21.9],
  // Tripura / Bangladesh border / Meghalaya
  [91.7, 23.0],
  [91.15, 23.85], // Agartala western pocket
  [91.3, 24.2],
  [92.4, 24.8],
  [92.2, 25.1],
  [91.0, 25.2],
  [89.9, 25.2],
  [89.8, 26.0],
  [88.8, 25.3],
  [88.2, 24.8],
  [88.5, 24.0],
  [88.6, 23.5],
  // West Bengal / Sundarbans
  [89.0, 22.4],
  [89.2, 21.6],
  [88.5, 21.5],
  // Bay of Bengal / Eastern Coast (Odisha, Andhra Pradesh, Tamil Nadu)
  [87.1, 21.5],
  [86.7, 20.8],
  [85.8, 19.8],
  [85.0, 19.4],
  [84.0, 18.5],
  [83.3, 17.7],
  [82.3, 16.9],
  [81.2, 16.0],
  [80.3, 15.0],
  [80.35, 13.8],
  [80.35, 13.2], // Chennai Metropolitan Coast
  [80.3, 12.9],
  [79.9, 11.8],
  [79.9, 10.8],
  [79.9, 10.3], // Point Calimere
  [79.3, 9.3],
  [79.35, 9.15],
  [78.2, 8.8],
  [77.55, 8.05], // Southernmost mainland Kanyakumari
  // Arabian Sea / Western Coast (Kerala, Karnataka, Goa, Maharashtra, Gujarat)
  [77.0, 8.3],
  [76.85, 8.5],
  [76.5, 9.0],
  [76.2, 9.9],
  [75.7, 11.25],
  [75.1, 12.1],
  [74.9, 12.7],
  [74.75, 13.0],
  [74.65, 13.5],
  [74.1, 14.8],
  [73.75, 15.3],
  [73.7, 15.6],
  [73.2, 16.8],
  [72.9, 18.2],
  [72.75, 18.9],
  [72.75, 19.3],
  [72.7, 20.0],
  [72.8, 20.5],
  [72.6, 21.0],
  [72.1, 21.7],
  // Saurashtra Peninsula & Kathiawar Coast (Gir Forest & Somnath)
  [71.8, 20.9],
  [70.9, 20.65],
  [70.3, 20.85],
  [69.55, 21.6],
  [68.95, 22.25], // Dwarka / Okha
  [69.0, 22.5],
  [69.8, 22.9],
  [69.3, 22.8],
  [68.5, 23.2],
  [68.15, 23.65], // Close polygon back at Kutch Sir Creek
];

/** Island territories bounding envelopes */
const ANDAMAN_NICOBAR_BOX: BoundingBox = {
  minLon: 92.0,
  minLat: 6.5,
  maxLon: 94.5,
  maxLat: 14.0,
};

const LAKSHADWEEP_BOX: BoundingBox = {
  minLon: 71.5,
  minLat: 8.0,
  maxLon: 74.5,
  maxLat: 12.5,
};

/**
 * Standard point-in-polygon test using ray-casting algorithm.
 * @param lon Target longitude
 * @param lat Target latitude
 * @param polygon Polygon vertices in [lon, lat] format
 */
function pointInPolygon(lon: number, lat: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];

    const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Validates whether a geographic point falls strictly within Indian sovereign territory
 * (including mainland India, Andaman & Nicobar, and Lakshadweep).
 */
export function isPointInIndia(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;

  // 1. Fast coarse envelope rejection
  if (
    lat < INDIA_BOUNDING_BOX.minLat ||
    lat > INDIA_BOUNDING_BOX.maxLat ||
    lon < INDIA_BOUNDING_BOX.minLon ||
    lon > INDIA_BOUNDING_BOX.maxLon
  ) {
    return false;
  }

  // 2. Island territories check
  if (
    lon >= ANDAMAN_NICOBAR_BOX.minLon &&
    lon <= ANDAMAN_NICOBAR_BOX.maxLon &&
    lat >= ANDAMAN_NICOBAR_BOX.minLat &&
    lat <= ANDAMAN_NICOBAR_BOX.maxLat
  ) {
    return true;
  }

  if (
    lon >= LAKSHADWEEP_BOX.minLon &&
    lon <= LAKSHADWEEP_BOX.maxLon &&
    lat >= LAKSHADWEEP_BOX.minLat &&
    lat <= LAKSHADWEEP_BOX.maxLat
  ) {
    return true;
  }

  // 3. Mainland territory containment test
  return pointInPolygon(lon, lat, INDIA_MAINLAND_POLYGON);
}

/**
 * Strict HTTP input assertion for coordinate queries.
 * Throws 400 Bad Request error if coordinates fall outside India.
 */
export function validateIndiaCoordinate(lat: number, lon: number): void {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    const err = new Error('Latitude and longitude parameters must be valid numeric coordinates.');
    (err as unknown as { statusCode: number }).statusCode = 400;
    throw err;
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    const err = new Error('Latitude must be between -90 and 90, and longitude between -180 and 180 degrees.');
    (err as unknown as { statusCode: number }).statusCode = 400;
    throw err;
  }

  if (!isPointInIndia(lat, lon)) {
    const err = new Error(
      `ATmosIQ is restricted exclusively to the sovereign territory of India. Coordinates (${lat.toFixed(4)}°, ${lon.toFixed(4)}°) fall outside India's geographic boundary.`
    );
    (err as unknown as { statusCode: number }).statusCode = 400;
    throw err;
  }
}

/**
 * Great-circle distance between two coordinates in kilometers using the Haversine formula.
 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
