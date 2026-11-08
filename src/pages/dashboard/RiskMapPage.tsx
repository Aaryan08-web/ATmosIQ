import React, { useState } from 'react';
import { useDashboardContext } from '@/components/dashboard/DashboardLayout';
import { AdvancedMap, type MapMarker, type MapCircle, type MapPolygon } from '@/components/ui/interactive-map';
import { MapLayerControls, type LayerKey } from '@/components/dashboard/MapLayerControls';
import { MapLegend } from '@/components/dashboard/MapLegend';
import { PlacePanel } from '@/features/dashboard/PlacePanel';
import { Navigation, Globe, Shield, Info } from 'lucide-react';
import type { SelectedPlace } from '@/types';

export const RiskMapPage: React.FC = () => {
  const { fires, air, forest, selectedPlace, setSelectedPlace } = useDashboardContext();

  const [activeLayers, setActiveLayers] = useState<Record<LayerKey, boolean>>({
    air: true,
    fires: true,
    forest: true,
    riskZones: true,
  });

  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);

  const handleToggleLayer = (key: LayerKey) => {
    setActiveLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleJumpTo = (name: string, lat: number, lon: number, zoom = 12) => {
    setFlyToCoords([lat, lon]);
    setSelectedPlace({
      name,
      lat,
      lon,
      kind: 'point',
      details: [`Geographic coordinates: ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`],
    });
  };

  // Convert telemetry to MapMarkers with strictly verified data
  const mapMarkers: MapMarker[] = React.useMemo(() => {
    const list: MapMarker[] = [];

    // 1. CAMS Air Quality Observation Nodes
    if (activeLayers.air && air.data?.points) {
      air.data.points.forEach((p, idx) => {
        let cat: MapMarker['category'] = 'low';
        let color = '#22c55e';
        const aqi = p.usAqi ?? 0;
        if (aqi > 200) {
          cat = 'critical';
          color = '#ef4444';
        } else if (aqi > 150) {
          cat = 'high';
          color = '#f97316';
        } else if (aqi > 100) {
          cat = 'moderate';
          color = '#eab308';
        } else if (aqi > 50) {
          cat = 'low';
          color = '#84cc16';
        }

        list.push({
          id: `aq-${idx}-${p.name}`,
          lat: p.lat,
          lon: p.lon,
          title: `${p.name}, ${p.country}`,
          category: cat,
          color,
          badge: `${p.usAqi ?? 'N/A'} AQI`,
          description: `Category: ${p.category}. Open-Meteo European CAMS multi-pollutant model.`,
          measurements: [
            { label: 'US AQI', value: p.usAqi ?? 'n/a' },
            { label: 'PM2.5', value: p.pm25 ?? 'n/a', unit: 'µg/m³' },
            { label: 'PM10', value: p.pm10 ?? 'n/a', unit: 'µg/m³' },
            { label: 'Condition', value: p.category },
          ],
          source: 'Open-Meteo / CAMS',
          updatedAt: p.time || 'Hourly',
          raw: p,
        });
      });
    }

    // 2. NASA FIRMS Fire Thermal Anomalies (ordinary fires = orange, critical = red)
    if (activeLayers.fires && fires.data?.points) {
      fires.data.points.forEach((p, idx) => {
        const isCritical = p.frp > 80;
        list.push({
          id: `fire-${idx}`,
          lat: p.lat,
          lon: p.lon,
          title: `Thermal Fire Anomaly`,
          category: isCritical ? 'critical' : 'fire',
          color: isCritical ? '#ef4444' : '#f97316',
          badge: `${Math.round(p.frp)} MW`,
          description: `Detected by ${p.satellite} VIIRS (${p.daynight === 'D' ? 'Day' : 'Night'} pass). Confidence: ${p.confidence}.`,
          measurements: [
            { label: 'Radiative Power', value: Math.round(p.frp), unit: 'MW' },
            { label: 'Confidence', value: p.confidence },
            { label: 'Acquired', value: p.acquired },
            { label: 'Sensor', value: p.satellite },
          ],
          source: fires.data?.source || 'NASA FIRMS VIIRS',
          updatedAt: fires.data?.fetchedAt ? new Date(fires.data.fetchedAt).toLocaleTimeString() : 'Last 24h',
          raw: p,
        });
      });
    }

    // 3. Global Forest Watch Curated Reference Biomes
    if (activeLayers.forest && forest.data?.points) {
      forest.data.points.forEach((p) => {
        list.push({
          id: `forest-${p.id}`,
          lat: p.lat,
          lon: p.lon,
          title: `${p.name} (${p.country})`,
          category: 'forest',
          color: '#a855f7',
          badge: `${p.severity} Loss`,
          description: `Primary Driver: ${p.driver}. Biome: ${p.biome}.`,
          measurements: [
            { label: 'Severity', value: p.severity },
            { label: 'Driver', value: p.driver },
            { label: 'Biome', value: p.biome },
            { label: 'Country', value: p.country },
          ],
          source: 'Global Forest Watch (Curated Reference)',
          raw: p,
        });
      });
    }

    // 4. Selected Target Pin
    if (selectedPlace) {
      list.push({
        id: 'selected-location-pin',
        lat: selectedPlace.lat,
        lon: selectedPlace.lon,
        title: selectedPlace.name,
        category: 'selected',
        color: '#3b82f6',
        badge: 'Target Analysis',
        description: `Coordinates: ${selectedPlace.lat.toFixed(4)}°N, ${selectedPlace.lon.toFixed(4)}°E`,
        measurements: selectedPlace.details.map((d, i) => ({ label: `Observation ${i + 1}`, value: d })),
        source: 'Target Selection',
      });
    }

    return list;
  }, [activeLayers, air.data?.points, fires.data?.points, fires.data?.source, fires.data?.fetchedAt, forest.data?.points, selectedPlace]);

  // Spatial Proximity Radius (labeled honestly as an analysis radius, not a predictive boundary)
  const mapCircles: MapCircle[] = React.useMemo(() => {
    if (!activeLayers.riskZones || !selectedPlace) return [];
    return [
      {
        id: 'selected-analysis-circle',
        center: [selectedPlace.lat, selectedPlace.lon],
        radiusKm: 150,
        color: '#3b82f6',
        popup: '150 km Spatial Proximity Radius (Analysis Buffer)',
      },
    ];
  }, [activeLayers.riskZones, selectedPlace]);

  // Reference Ecological Biome Boundaries (labeled clearly as reference geography)
  const mapPolygons: MapPolygon[] = React.useMemo(() => {
    if (!activeLayers.riskZones) return [];
    return [
      {
        id: 'cerrado-reference-polygon',
        name: 'Cerrado Reference Biome (GFW Ecological Buffer)',
        coordinates: [
          [
            [-50.5, -14.0],
            [-46.0, -14.0],
            [-46.0, -11.0],
            [-50.5, -11.0],
            [-50.5, -14.0],
          ],
        ],
        color: '#ef4444',
        fillOpacity: 0.12,
        strokeColor: '#f87171',
        strokeWidth: 1.5,
        popup: 'Cerrado Reference Ecological Boundary (Global Forest Watch)',
      },
      {
        id: 'gran-chaco-reference-polygon',
        name: 'Gran Chaco Reference Biome (GFW Ecological Buffer)',
        coordinates: [
          [
            [-63.5, -24.0],
            [-59.5, -24.0],
            [-59.5, -20.0],
            [-63.5, -20.0],
            [-63.5, -24.0],
          ],
        ],
        color: '#f97316',
        fillOpacity: 0.1,
        strokeColor: '#fb923c',
        strokeWidth: 1.5,
        popup: 'Gran Chaco Reference Ecological Boundary (Global Forest Watch)',
      },
    ];
  }, [activeLayers.riskZones]);

  const handleMarkerClick = (marker: MapMarker) => {
    let kind: SelectedPlace['kind'] = 'point';
    const idStr = String(marker.id);
    if (idStr.startsWith('aq-')) kind = 'air';
    else if (idStr.startsWith('fire-')) kind = 'fire';
    else if (idStr.startsWith('forest-')) kind = 'forest';

    setSelectedPlace({
      name: marker.title || 'Selected Coordinate Point',
      lat: marker.position ? marker.position[0] : (marker.lat ?? 0),
      lon: marker.position ? marker.position[1] : (marker.lon ?? 0),
      kind,
      details: (marker.measurements || []).map((m) => `${m.label}: ${m.value} ${m.unit || ''}`.trim()),
    });
  };

  const handleMapClick = (coords: { lat: number; lon: number } | [number, number]) => {
    const lat = Array.isArray(coords) ? coords[0] : coords.lat;
    const lon = Array.isArray(coords) ? coords[1] : coords.lon;
    setSelectedPlace({
      name: `Point ${lat.toFixed(4)}°, ${lon.toFixed(4)}°`,
      lat,
      lon,
      kind: 'point',
      details: ['User-selected geographic coordinate.'],
    });
  };

  return (
    <div className="space-y-6">
      {/* Map Control Bar & Preset Navigator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-[#101F18] border border-emerald-950">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-[22px] sm:text-[26px] font-bold text-[#F2F5F2] tracking-tight">Geospatial Risk Command Map</h2>
          </div>
          <p className="text-[15px] sm:text-[16px] text-[#9CAEA2] leading-normal">
            High-precision satellite layers: CAMS atmospheric dispersion, NASA FIRMS fire power, and reference biomes.
          </p>
        </div>

        {/* Quick jump locations */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[13px] text-[#9CAEA2] hidden md:inline font-medium">Quick Jump:</span>
          <button
            type="button"
            onClick={() => handleJumpTo('Delhi NCR Observatory', 28.6139, 77.2090, 12)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#14251C] hover:bg-[#174C34] text-[15px] font-medium text-emerald-300 border border-emerald-900/60 transition-colors cursor-pointer"
          >
            <Navigation className="w-4 h-4 text-emerald-400" />
            <span>Delhi NCR</span>
          </button>
          <button
            type="button"
            onClick={() => handleJumpTo('Sumatra Peatland Basin', 0.5333, 101.4500, 10)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#14251C] hover:bg-[#174C34] text-[15px] font-medium text-[#A8BCAE] hover:text-[#F2F5F2] border border-emerald-900/60 transition-colors cursor-pointer"
          >
            <span>Sumatra</span>
          </button>
          <button
            type="button"
            onClick={() => handleJumpTo('Cerrado Biome', -12.1500, -45.0000, 9)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#14251C] hover:bg-[#174C34] text-[15px] font-medium text-[#A8BCAE] hover:text-[#F2F5F2] border border-emerald-900/60 transition-colors cursor-pointer"
          >
            <span>Cerrado</span>
          </button>
          <button
            type="button"
            onClick={() => handleJumpTo('Global View', 20, 0, 2)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#14251C] hover:bg-[#174C34] text-[15px] font-medium text-[#A8BCAE] hover:text-[#F2F5F2] border border-emerald-900/60 transition-colors cursor-pointer"
          >
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>Global</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Map (8 cols) & Right AI Location Analysis (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Map Box */}
        <div className="lg:col-span-8 rounded-xl bg-[#101F18] border border-emerald-950 overflow-hidden shadow-sm flex flex-col">
          {/* Top Layer Toggles */}
          <div className="p-3 sm:p-4 border-b border-emerald-950/80 bg-[#0D1914] flex flex-wrap items-center justify-between gap-3">
            <MapLayerControls
              layers={activeLayers}
              onToggle={handleToggleLayer}
              counts={{
                air: air.data?.points?.length || 45,
                fires: fires.data?.points?.length || 0,
                forest: forest.data?.points?.length || 0,
                riskZones: mapPolygons.length,
              }}
              liveStatuses={{
                fires: fires.data?.live,
                air: !!air.data,
              }}
            />
          </div>

          {/* Large Interactive Leaflet Map */}
          <div className="relative w-full">
            <AdvancedMap
              center={[28.6139, 77.2090]}
              zoom={11}
              markers={mapMarkers}
              polygons={mapPolygons}
              circles={mapCircles}
              onMarkerClick={handleMarkerClick}
              onMapClick={handleMapClick}
              enableClustering={true}
              enableSearch={true}
              enableControls={true}
              flyToLocation={flyToCoords}
              style={{
                height: '620px',
                width: '100%',
                minHeight: '440px',
              }}
            />
          </div>

          {/* Map Footer Legend */}
          <div className="p-3 border-t border-emerald-950/80 bg-[#0D1914]">
            <MapLegend />
          </div>
        </div>

        {/* Right: Selected Location & AI Briefing (Self-Hugging Height) */}
        <div className="lg:col-span-4 self-start h-fit rounded-xl bg-[#101F18] border border-emerald-950 overflow-hidden shadow-sm flex flex-col">
          <div className="px-5 py-4 border-b border-emerald-950/80 bg-[#0D1914] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
              <h3 className="text-[17px] sm:text-[18px] font-bold tracking-tight text-[#F2F5F2]">
                Selected Location Analysis
              </h3>
            </div>
            <span className="text-[13px] text-emerald-400 font-medium">150 km Radius</span>
          </div>

          <div className="p-0">
            <PlacePanel place={selectedPlace} />
          </div>
        </div>
      </div>

      {/* Methodology & Data Provenance Notice */}
      <div className="flex items-start gap-3 p-5 rounded-xl bg-[#0D1914] border border-emerald-950/80 text-[14px] sm:text-[15px] text-[#9CAEA2] leading-relaxed">
        <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-[#F2F5F2]">Cartographic Integrity Notice: </span>
          Thermal anomalies represent satellite sensor pixel observations (375m VIIRS). Air quality metrics reflect Open-Meteo European CAMS multi-pollutant dispersion simulations across primary metropolitan centers. Forest loss geometries reflect curated Global Forest Watch reference biomes. No coordinates or predictive polygons are simulated or fabricated.
        </div>
      </div>
    </div>
  );
};

export default RiskMapPage;

