import { getGfwSyncStatus, getGfwForestAlerts, INDIAN_FOREST_AOIS } from './gfwIngestion.js';

export interface DeforestationHotspot {
  id: string;
  name: string;
  state: string;
  country: string;
  lat: number;
  lon: number;
  biome: string;
  driver: string;
  severity: 'Critical' | 'High' | 'Moderate';
  type?: 'reference';
}

/**
 * Curated Catalog of Authoritative Indian Forest Regions & Protected Biomes
 * Covers critical biodiversity hotspots, tiger corridors, and mangrove biomes across India.
 */
export const INDIAN_FOREST_HOTSPOTS: DeforestationHotspot[] = [
  {
    id: 'in-df-1',
    name: 'Western Ghats · Nilgiri Biosphere',
    state: 'Kerala / Tamil Nadu / Karnataka',
    country: 'India',
    lat: 11.45,
    lon: 76.65,
    biome: 'Tropical Wet Evergreen & Shola',
    driver: 'Plantation conversion & infrastructure pressure',
    severity: 'Critical',
    type: 'reference',
  },
  {
    id: 'in-df-2',
    name: 'Western Ghats · Koyna-Mahabaleshwar Corridor',
    state: 'Maharashtra',
    country: 'India',
    lat: 17.58,
    lon: 73.72,
    biome: 'Semi-Evergreen & Moist Deciduous',
    driver: 'Hydroelectric catchment clearance & linear infrastructure',
    severity: 'High',
    type: 'reference',
  },
  {
    id: 'in-df-3',
    name: 'Sundarbans Biosphere Reserve',
    state: 'West Bengal',
    country: 'India',
    lat: 21.95,
    lon: 88.85,
    biome: 'Tidal Halophytic Mangrove Delta',
    driver: 'Aquaculture conversion & extreme cyclone erosion',
    severity: 'Critical',
    type: 'reference',
  },
  {
    id: 'in-df-4',
    name: 'Saranda Forest & Singhbhum Belt',
    state: 'Jharkhand',
    country: 'India',
    lat: 22.30,
    lon: 85.35,
    biome: 'Dense Sal (Shorea robusta) Deciduous',
    driver: 'Iron ore mining leases & commercial haulage corridors',
    severity: 'Critical',
    type: 'reference',
  },
  {
    id: 'in-df-5',
    name: 'Karbi Anglong & Kaziranga Wildlife Corridor',
    state: 'Assam',
    country: 'India',
    lat: 26.25,
    lon: 93.35,
    biome: 'Subtropical Moist Mixed Deciduous',
    driver: 'Shifting cultivation cycles & highway corridor bisection',
    severity: 'High',
    type: 'reference',
  },
  {
    id: 'in-df-6',
    name: 'Dampa Tiger Reserve & Western Hills',
    state: 'Mizoram',
    country: 'India',
    lat: 23.68,
    lon: 92.42,
    biome: 'Tropical Semi-Evergreen Rainforest',
    driver: 'Slash-and-burn agrarian pressure & border roads',
    severity: 'High',
    type: 'reference',
  },
  {
    id: 'in-df-7',
    name: 'Rajaji-Corbett Shivalik Landscape',
    state: 'Uttarakhand',
    country: 'India',
    lat: 29.85,
    lon: 78.45,
    biome: 'Sub-Himalayan Upper Gangetic Sal',
    driver: 'Peri-urban expansion & tourist infrastructure corridors',
    severity: 'High',
    type: 'reference',
  },
  {
    id: 'in-df-8',
    name: 'Gir Deciduous Forest Landscape',
    state: 'Gujarat',
    country: 'India',
    lat: 21.15,
    lon: 70.80,
    biome: 'Tropical Dry Deciduous Teak & Thorn',
    driver: 'Agricultural fringe pressure & intensive livestock grazing',
    severity: 'Moderate',
    type: 'reference',
  },
  {
    id: 'in-df-9',
    name: 'Satpura-Maikal Kanha-Pench Corridor',
    state: 'Madhya Pradesh',
    country: 'India',
    lat: 22.35,
    lon: 80.60,
    biome: 'Central Indian Dry & Moist Deciduous',
    driver: 'Linear transport bisection & seasonal fire regimes',
    severity: 'High',
    type: 'reference',
  },
  {
    id: 'in-df-10',
    name: 'Similipal Biosphere Reserve',
    state: 'Odisha',
    country: 'India',
    lat: 21.85,
    lon: 86.35,
    biome: 'Northern Tropical Semi-Evergreen',
    driver: 'Seasonal forest fire vulnerability & unorganized harvesting',
    severity: 'High',
    type: 'reference',
  },
  {
    id: 'in-df-11',
    name: 'Silent Valley National Park Core',
    state: 'Kerala',
    country: 'India',
    lat: 11.08,
    lon: 76.45,
    biome: 'Pristine Equatorial Wet Evergreen',
    driver: 'Buffer zone monoculture plantation encroachment',
    severity: 'Moderate',
    type: 'reference',
  },
  {
    id: 'in-df-12',
    name: 'Great Nicobar Biosphere Reserve',
    state: 'Andaman & Nicobar Islands',
    country: 'India',
    lat: 7.05,
    lon: 93.85,
    biome: 'Insular Tropical Coastal Rainforest',
    driver: 'Port and infrastructure development footprint',
    severity: 'Critical',
    type: 'reference',
  },
];

// Backwards compatibility alias
export const DEFORESTATION_HOTSPOTS = INDIAN_FOREST_HOTSPOTS;

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

export function getDeforestation() {
  const syncStatus = getGfwSyncStatus();
  const liveAlerts = getGfwForestAlerts(100);
  const isSyncSuccess = syncStatus.status === 'success';

  const categories: ForestCategoriesSummary = {
    liveAlertsCount: liveAlerts.length,
    curatedReservesCount: INDIAN_FOREST_HOTSPOTS.length,
    historicalBenchmarksAvailable: true,
    hasDemoData: false,
  };

  const metadata: ForestMetadata = {
    datasetName: 'GFW Integrated Alerts (GLAD-L, GLAD-S2, RADD) & FSI ISFR Biennial Canopy Census',
    coverage: 'Republic of India · 12 Active Surveillance AOIs across Western Ghats, Northeast, Central India, Eastern India, Himalayan Shivaliks, Sundarbans & Great Nicobar',
    observationPeriod: 'Near-Real-Time (NRT 8-Day Satellite Revisit) + Biennial Forest Survey Baselines',
    source: isSyncSuccess
      ? 'Global Forest Watch (WRI / UMD) & Forest Survey of India (FSI/MoEFCC)'
      : 'Curated Indian Protected Reserves (FSI/MoEFCC Baselines)',
    lastSync: syncStatus.last_success_at,
    status: syncStatus.status,
  };

  return {
    points: INDIAN_FOREST_HOTSPOTS,
    referencePoints: INDIAN_FOREST_HOTSPOTS,
    curatedReserves: INDIAN_FOREST_HOTSPOTS,
    monitoredAois: INDIAN_FOREST_AOIS,
    liveAlerts,
    syncStatus,
    categories,
    metadata,
    unmonitoredNotice: 'Near-real-time satellite surveillance is concentrated over 12 high-priority national ecological corridors. Unmonitored forest tracts must NOT be interpreted as zero canopy disturbance.',
    source: metadata.source,
    live: isSyncSuccess && liveAlerts.length > 0,
    fetchedAt: new Date().toISOString(),
  };
}
