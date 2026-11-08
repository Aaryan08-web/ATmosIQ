export interface DeforestationHotspot {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  biome: string;
  driver: string;
  severity: 'Critical' | 'High' | 'Moderate';
}

/**
 * Curated hotspot reference list (NOT a live feed).
 * Locations and drivers are well-documented in Global Forest Watch / UMD tree-cover-loss
 * reporting; severity is a qualitative ranking. Verify specifics on globalforestwatch.org
 * before quoting figures. A live GFW integration is on the backlog.
 */
export const DEFORESTATION_HOTSPOTS: DeforestationHotspot[] = [
  { id: 'df-1', name: 'Southern Amazon Arc', country: 'Brazil / Bolivia', lat: -9.5, lon: -62.0, biome: 'Tropical moist forest', driver: 'Cattle ranching and soy expansion', severity: 'Critical' },
  { id: 'df-2', name: 'Cerrado Frontier (MATOPIBA)', country: 'Brazil', lat: -9.0, lon: -45.5, biome: 'Tropical savanna', driver: 'Large-scale agriculture', severity: 'Critical' },
  { id: 'df-3', name: 'Chiquitano Dry Forest', country: 'Bolivia', lat: -16.5, lon: -61.0, biome: 'Tropical dry forest', driver: 'Agricultural clearing and fire', severity: 'High' },
  { id: 'df-4', name: 'Congo Basin Fringe', country: 'DR Congo', lat: -1.5, lon: 23.0, biome: 'Equatorial rainforest', driver: 'Smallholder farming and charcoal', severity: 'High' },
  { id: 'df-5', name: 'Miombo Woodlands', country: 'Zambia / Angola', lat: -12.5, lon: 24.5, biome: 'Tropical woodland', driver: 'Charcoal and farmland expansion', severity: 'High' },
  { id: 'df-6', name: 'Kalimantan Lowlands', country: 'Indonesia', lat: -1.5, lon: 113.5, biome: 'Peat swamp / lowland forest', driver: 'Palm oil, pulpwood, mining', severity: 'High' },
  { id: 'df-7', name: 'Sumatra Peatlands', country: 'Indonesia', lat: -1.0, lon: 102.0, biome: 'Peat forest', driver: 'Plantation conversion', severity: 'High' },
  { id: 'df-8', name: 'Gran Chaco', country: 'Paraguay / Argentina', lat: -22.5, lon: -60.5, biome: 'Dry forest', driver: 'Cattle ranching', severity: 'High' },
  { id: 'df-9', name: 'Central Highlands Mekong', country: 'Cambodia / Laos', lat: 13.5, lon: 106.5, biome: 'Tropical moist forest', driver: 'Commercial plantations', severity: 'Moderate' },
  { id: 'df-10', name: 'Siberian Taiga Belt', country: 'Russia', lat: 58.0, lon: 100.0, biome: 'Boreal forest', driver: 'Wildfire and logging', severity: 'High' },
  { id: 'df-11', name: 'Western Ghats Edge', country: 'India', lat: 11.5, lon: 76.5, biome: 'Tropical moist forest', driver: 'Plantation and infrastructure pressure', severity: 'Moderate' },
  { id: 'df-12', name: 'Northeast India Hills', country: 'India', lat: 25.5, lon: 93.5, biome: 'Subtropical forest', driver: 'Shifting cultivation and logging', severity: 'Moderate' },
];

export function getDeforestation() {
  return {
    points: DEFORESTATION_HOTSPOTS,
    source: 'Curated hotspot reference (Global Forest Watch / UMD reporting) — not a live feed',
    live: false,
    fetchedAt: new Date().toISOString(),
  };
}
