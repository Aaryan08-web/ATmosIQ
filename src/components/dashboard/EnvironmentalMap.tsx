import React, { useState, useMemo, useCallback } from 'react';
import type { AqResult, DeforestationResult, FireResult, SelectedPlace } from '@/types';
import { AdvancedMap, type MapMarker, type MapCircle, type MapPolygon } from '@/components/ui/interactive-map';
import { MapLayerControls, type LayerKey } from './MapLayerControls';
import { MapLegend } from './MapLegend';
import { PlacePanel } from '@/features/dashboard/PlacePanel';

interface EnvironmentalMapProps {
  fires: FireResult | null;
  air: AqResult | null;
  forest: DeforestationResult | null;
  selectedPlace?: SelectedPlace | null;
  onSelectPlace?: (place: SelectedPlace) => void;
  flyToCoords?: [number, number] | null; // [lat, lon]
  className?: string;
}

export const EnvironmentalMap: React.FC<EnvironmentalMapProps> = ({
  fires,
  air,
  forest,
  selectedPlace,
  onSelectPlace,
  flyToCoords,
  className = '',
}) => {
  const [activeLayers, setActiveLayers] = useState<Record<LayerKey, boolean>>({
    air: true,
    fires: true,
    forest: true,
    riskZones: true,
  });

  const [internalSelected, setInternalSelected] = useState<SelectedPlace | null>(null);
  const activeSelected = selectedPlace !== undefined ? selectedPlace : internalSelected;

  const handleToggleLayer = (key: LayerKey) => {
    setActiveLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelect = useCallback(
    (place: SelectedPlace) => {
      setInternalSelected(place);
      onSelectPlace?.(place);
    },
    [onSelectPlace]
  );

  // Transform live backend data into AdvancedMap MapMarker array
  const mapMarkers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];

    // 1. Air Quality Markers
    if (activeLayers.air && air?.points) {
      air.points.forEach((p, idx) => {
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
          description: `Category: ${p.category}. Continuous CAMS atmospheric observation.`,
          measurements: [
            { label: 'US AQI', value: p.usAqi ?? 'n/a' },
            { label: 'PM2.5', value: p.pm25 ?? 'n/a', unit: 'µg/m³' },
            { label: 'PM10', value: p.pm10 ?? 'n/a', unit: 'µg/m³' },
            { label: 'Status', value: p.category },
          ],
          source: 'Open-Meteo / CAMS',
          updatedAt: p.time ? new Date(p.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live',
          raw: p,
        });
      });
    }

    // 2. NASA FIRMS Fire Markers
    if (activeLayers.fires && fires?.points) {
      fires.points.forEach((p, idx) => {
        const isCritical = p.frp > 100;
        list.push({
          id: `fire-${idx}`,
          lat: p.lat,
          lon: p.lon,
          title: `Thermal Anomaly (Fire Detection)`,
          category: isCritical ? 'critical' : 'fire',
          color: isCritical ? '#ef4444' : '#f97316',
          badge: `${Math.round(p.frp)} MW`,
          description: `Detected by ${p.satellite} satellite (${p.daynight === 'D' ? 'Day' : 'Night'} pass).`,
          measurements: [
            { label: 'Radiative Power', value: Math.round(p.frp), unit: 'MW' },
            { label: 'Confidence', value: p.confidence },
            { label: 'Acquired', value: p.acquired },
            { label: 'Sensor', value: p.satellite },
          ],
          source: fires.source || 'NASA FIRMS VIIRS',
          updatedAt: fires.fetchedAt ? new Date(fires.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '24h NRT',
          raw: p,
        });
      });
    }

    // 3. Deforestation Hotspots
    if (activeLayers.forest && forest?.points) {
      forest.points.forEach((p) => {
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
          source: 'Global Forest Watch (Ref)',
          updatedAt: 'Curated dataset',
          raw: p,
        });
      });
    }

    // 4. Selected Location Marker
    if (activeSelected) {
      list.push({
        id: 'selected-location-marker',
        lat: activeSelected.lat,
        lon: activeSelected.lon,
        title: activeSelected.name,
        category: 'selected',
        color: '#3b82f6',
        badge: 'Target Area',
        description: `Coordinates: ${activeSelected.lat.toFixed(3)}°N, ${activeSelected.lon.toFixed(3)}°E`,
        measurements: activeSelected.details.map((d, i) => ({ label: `Spec ${i + 1}`, value: d })),
        source: 'User Selection',
      });
    }

    return list;
  }, [activeLayers, air?.points, fires?.points, fires?.source, fires?.fetchedAt, forest?.points, activeSelected]);

  // Circles for Proximity Analysis Radius (150 km spatial proximity radius around selected location)
  const mapCircles = useMemo<MapCircle[]>(() => {
    if (!activeLayers.riskZones || !activeSelected) return [];
    return [
      {
        id: 'selected-radius-circle',
        center: [activeSelected.lat, activeSelected.lon],
        radiusKm: 150,
        color: '#3b82f6',
        label: '150 km Spatial Proximity Radius (Analysis Buffer)',
      },
    ];
  }, [activeLayers.riskZones, activeSelected]);

  // Curated Environmental Reference Biome Polygons (Global Forest Watch reference data)
  const mapPolygons = useMemo<MapPolygon[]>(() => {
    if (!activeLayers.riskZones) return [];
    return [
      {
        id: 'cerrado-risk-zone',
        name: 'Cerrado Reference Biome (GFW Ecological Boundary)',
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
        category: 'Reference Ecological Boundary',
      },
      {
        id: 'gran-chaco-risk-zone',
        name: 'Gran Chaco Reference Biome (GFW Ecological Boundary)',
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
        category: 'Reference Ecological Boundary',
      },
    ];
  }, [activeLayers.riskZones]);

  // Handle marker click
  const handleMarkerClick = (marker: MapMarker) => {
    let kind: SelectedPlace['kind'] = 'point';
    const idStr = String(marker.id);
    if (idStr.startsWith('aq-')) kind = 'air';
    else if (idStr.startsWith('fire-')) kind = 'fire';
    else if (idStr.startsWith('forest-')) kind = 'forest';

    handleSelect({
      name: marker.title || 'Feature Location',
      lat: marker.position ? marker.position[0] : (marker.lat ?? 0),
      lon: marker.position ? marker.position[1] : (marker.lon ?? 0),
      kind,
      details: (marker.measurements || []).map((m) => `${m.label}: ${m.value} ${m.unit || ''}`.trim()),
    });
  };

  // Handle map click
  const handleMapClick = (coords: { lat: number; lon: number } | [number, number]) => {
    const lat = Array.isArray(coords) ? coords[0] : coords.lat;
    const lon = Array.isArray(coords) ? coords[1] : coords.lon;
    handleSelect({
      name: `Point ${lat.toFixed(3)}°, ${lon.toFixed(3)}°`,
      lat,
      lon,
      kind: 'point',
      details: ['Manual target point selection.'],
    });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Map Container Card */}
      <div className="rounded-xl bg-[#101F18] border border-emerald-950 p-4 sm:p-5 shadow-sm space-y-4">
        {/* Header: Title, Description, and Layer Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-emerald-950/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <h3 className="text-base sm:text-lg font-bold text-[#F2F5F2] tracking-tight">
                Environmental Intelligence Map
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-[#9CAEA2]">
              Explore environmental conditions, monitor vulnerable zones, and investigate emerging threats.
            </p>
          </div>

          <MapLayerControls
            layers={activeLayers}
            onToggle={handleToggleLayer}
            counts={{
              air: air?.points?.length || 45,
              fires: fires?.points?.length || 0,
              forest: forest?.points?.length || 0,
              riskZones: mapPolygons.length,
            }}
            liveStatuses={{
              fires: fires?.live,
              air: air?.live,
            }}
          />
        </div>

        {/* The Advanced Map Instance */}
        <div className="relative">
          <AdvancedMap
            center={[18.5204, 73.8567]} // Pune, Maharashtra
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
              height: '560px',
              width: '100%',
              minHeight: '380px',
            }}
          />
        </div>

        {/* Legend Bar */}
        <MapLegend />
      </div>

      {/* Selected Location Details Panel & AI Brief */}
      <div className="rounded-xl bg-[#14251C] border border-emerald-950 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-emerald-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[#F2F5F2]">
              Selected Location Analysis &amp; Briefing
            </h4>
          </div>
          <span className="text-[10px] font-mono text-[#9CAEA2]">150 km radius</span>
        </div>
        <PlacePanel place={activeSelected} />
      </div>
    </div>
  );
};

export default EnvironmentalMap;
