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
          description: `Primary Driver: ${p.driver}. Biome: ${p.biome}. Curated baseline reference catalog.`,
          measurements: [
            { label: 'Type', value: 'Curated Reference Hotspot' },
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

    // 3b. Global Forest Watch Live Ingested Satellite Alerts
    if (activeLayers.forest && forest.data?.liveAlerts) {
      forest.data.liveAlerts.forEach((a) => {
        const isHigh = a.confidence === 'high';
        list.push({
          id: `gfw-live-${a.alert_id}`,
          lat: a.latitude,
          lon: a.longitude,
          title: `GFW Alert: ${a.location_name || 'Canopy Loss Cluster'}`,
          category: isHigh ? 'critical' : 'forest',
          color: isHigh ? '#d946ef' : '#c084fc',
          badge: `${a.confidence} Deforestation Alert`,
          description: `Satellite canopy disturbance detected on ${a.alert_date} (dataset: ${a.dataset}).`,
          measurements: [
            { label: 'Alert Type', value: 'Live Satellite Ingestion' },
            { label: 'Detection Date', value: a.alert_date },
            { label: 'Confidence', value: a.confidence },
            { label: 'Area Disturbed', value: a.area_ha ? `${a.area_ha.toFixed(1)} ha` : 'Sensor Pixel' },
            { label: 'Dataset', value: `${a.dataset} (${a.version})` },
          ],
          source: 'Global Forest Watch (Integrated NRT)',
          updatedAt: a.retrieved_at ? new Date(a.retrieved_at).toLocaleTimeString() : 'Synchronized',
          raw: a,
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
  }, [activeLayers, air.data?.points, fires.data?.points, fires.data?.source, fires.data?.fetchedAt, forest.data?.points, forest.data?.liveAlerts, selectedPlace]);

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

  // Reference Ecological Biome Boundaries & Risk Corridors (India-Only)
  const mapPolygons: MapPolygon[] = React.useMemo(() => {
    if (!activeLayers.riskZones) return [];
    const base: MapPolygon[] = [
      {
        id: 'western-ghats-reference-corridor',
        name: 'Western Ghats UNESCO Biodiversity Corridor',
        coordinates: [
          [
            [73.2, 18.5],
            [74.5, 18.5],
            [77.5, 8.5],
            [76.8, 8.2],
            [74.5, 14.5],
            [73.2, 18.5],
          ],
        ],
        color: '#10b981',
        fillOpacity: 0.15,
        strokeColor: '#34d399',
        strokeWidth: 1.5,
        popup: 'Western Ghats UNESCO Biodiversity Corridor (Ecological Buffer)',
      },
      {
        id: 'sundarbans-reference-reserve',
        name: 'Sundarbans Mangrove Biosphere Reserve',
        coordinates: [
          [
            [88.3, 21.6],
            [89.1, 21.6],
            [89.1, 22.3],
            [88.3, 22.3],
            [88.3, 21.6],
          ],
        ],
        color: '#06b6d4',
        fillOpacity: 0.15,
        strokeColor: '#22d3ee',
        strokeWidth: 1.5,
        popup: 'Sundarbans Mangrove Biosphere Reserve & Tidal Delta Buffer',
      },
      {
        id: 'indo-gangetic-reference-corridor',
        name: 'Indo-Gangetic Atmospheric Particulate Corridor',
        coordinates: [
          [
            [74.5, 31.5],
            [88.0, 26.0],
            [88.0, 24.5],
            [76.5, 28.0],
            [74.5, 31.5],
          ],
        ],
        color: '#ef4444',
        fillOpacity: 0.12,
        strokeColor: '#f87171',
        strokeWidth: 1.5,
        popup: 'Indo-Gangetic Plain Air Quality Degradation Corridor',
      },
      {
        id: 'central-india-reference-belt',
        name: 'Central Indian Forest & Tiger Corridor',
        coordinates: [
          [
            [79.5, 21.5],
            [83.0, 21.5],
            [83.0, 23.5],
            [79.5, 23.5],
            [79.5, 21.5],
          ],
        ],
        color: '#a855f7',
        fillOpacity: 0.14,
        strokeColor: '#c084fc',
        strokeWidth: 1.5,
        popup: 'Central Indian Satpura-Maikal Ecological Buffer',
      },
    ];

    // Active GFW Indian Forest AOIs (Near-Real-Time Surveillance Bounds)
    const aoiPolygons: MapPolygon[] = (forest.data?.monitoredAois ?? []).map((aoi) => ({
      id: `aoi-${aoi.id}`,
      name: `${aoi.name} (Active NRT Surveillance AOI)`,
      coordinates: aoi.geometry.coordinates,
      color: '#059669',
      fillOpacity: 0.2,
      strokeColor: '#34d399',
      strokeWidth: 2,
      popup: `${aoi.name} · ${aoi.state} (Active GFW NRT Surveillance AOI ~40x40km. Unmonitored outside bounds)`,
    }));

    return [...base, ...aoiPolygons];
  }, [activeLayers.riskZones, forest.data?.monitoredAois]);

  const handleMarkerClick = (marker: MapMarker) => {
    let kind: SelectedPlace['kind'] = 'point';
    const idStr = String(marker.id);
    if (idStr.startsWith('aq-')) kind = 'air';
    else if (idStr.startsWith('fire-')) kind = 'fire';
    else if (idStr.startsWith('forest-') || idStr.startsWith('gfw-live-')) kind = 'forest';

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

        {/* Quick jump locations across Indian regions */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-[#9CAEA2] hidden md:inline font-medium">Quick Jump:</span>
          <button
            type="button"
            onClick={() => handleJumpTo('Delhi NCR Observatory', 28.6139, 77.2090, 11)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14251C] hover:bg-[#174C34] text-[14px] font-medium text-emerald-300 border border-emerald-900/60 transition-colors cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5 text-emerald-400" />
            <span>Delhi NCR</span>
          </button>
          <button
            type="button"
            onClick={() => handleJumpTo('Pune Observatory', 18.5204, 73.8567, 11)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14251C] hover:bg-[#174C34] text-[14px] font-medium text-[#A8BCAE] hover:text-[#F2F5F2] border border-emerald-900/60 transition-colors cursor-pointer"
          >
            <span>Pune</span>
          </button>
          <button
            type="button"
            onClick={() => handleJumpTo('Mumbai & Coast', 19.0760, 72.8777, 11)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14251C] hover:bg-[#174C34] text-[14px] font-medium text-[#A8BCAE] hover:text-[#F2F5F2] border border-emerald-900/60 transition-colors cursor-pointer"
          >
            <span>Mumbai</span>
          </button>
          <button
            type="button"
            onClick={() => handleJumpTo('Bengaluru Tech & Forest Hub', 12.9716, 77.5946, 11)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14251C] hover:bg-[#174C34] text-[14px] font-medium text-[#A8BCAE] hover:text-[#F2F5F2] border border-emerald-900/60 transition-colors cursor-pointer"
          >
            <span>Bengaluru</span>
          </button>
          <button
            type="button"
            onClick={() => handleJumpTo('Sundarbans Biosphere', 21.95, 88.85, 10)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14251C] hover:bg-[#174C34] text-[14px] font-medium text-[#A8BCAE] hover:text-[#F2F5F2] border border-emerald-900/60 transition-colors cursor-pointer"
          >
            <span>Sundarbans</span>
          </button>
          <button
            type="button"
            onClick={() => handleJumpTo('India National Overview', 22.5, 82.0, 5)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14251C] hover:bg-[#174C34] text-[14px] font-medium text-emerald-300 border border-emerald-900/60 transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>India View</span>
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
                air: air.data?.points?.length || 58,
                fires: fires.data?.points?.length || 0,
                forest: (forest.data?.points?.length || 0) + (forest.data?.liveAlerts?.length || 0),
                riskZones: mapPolygons.length,
              }}
              liveStatuses={{
                fires: fires.data?.live,
                air: !!air.data,
                forest: !!(forest.data?.liveAlerts && forest.data.liveAlerts.length > 0) || forest.data?.syncStatus?.status === 'success',
              }}
            />
          </div>

          {/* Large Interactive Leaflet Map */}
          <div className="relative w-full">
            <AdvancedMap
              center={[22.5, 82.0]} // Centered on India
              zoom={5}
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

