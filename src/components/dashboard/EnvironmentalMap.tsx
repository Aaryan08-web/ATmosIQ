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

    // 3. Deforestation Hotspots (Curated Reference)
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
          description: `Primary Driver: ${p.driver}. Biome: ${p.biome}. Curated baseline reference catalog.`,
          measurements: [
            { label: 'Type', value: 'Curated Reference Hotspot' },
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

    // 3b. Live GFW Ingested Forest Loss Alerts
    if (activeLayers.forest && forest?.liveAlerts) {
      forest.liveAlerts.forEach((a) => {
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
  }, [activeLayers, air?.points, fires?.points, fires?.source, fires?.fetchedAt, forest?.points, forest?.liveAlerts, activeSelected]);

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

  // Curated Indian Ecological Biome Boundaries & Risk Corridors
  const mapPolygons = useMemo<MapPolygon[]>(() => {
    if (!activeLayers.riskZones) return [];
    const base: MapPolygon[] = [
      {
        id: 'western-ghats-corridor',
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
        popup: 'Protected Indian Ecological Corridor',
      },
      {
        id: 'sundarbans-reserve',
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
        popup: 'Coastal Mangrove Delta Buffer',
      },
      {
        id: 'indo-gangetic-corridor',
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
        popup: 'Atmospheric Particulate Concentration Zone',
      },
      {
        id: 'central-india-forest-belt',
        name: 'Central Indian Forest & Wildlife Corridor',
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
        popup: 'Central Indian Forest Ecosystem Buffer',
      },
    ];

    const aoiPolygons: MapPolygon[] = (forest?.monitoredAois ?? []).map((aoi) => ({
      id: `aoi-${aoi.id}`,
      name: `${aoi.name} (Active NRT Surveillance AOI)`,
      coordinates: aoi.geometry.coordinates,
      color: '#059669',
      fillOpacity: 0.2,
      strokeColor: '#34d399',
      strokeWidth: 2,
      category: 'Active GFW NRT Surveillance AOI',
      popup: `${aoi.name} · ${aoi.state} (Active GFW NRT Surveillance AOI ~40x40km. Unmonitored outside bounds)`,
    }));

    return [...base, ...aoiPolygons];
  }, [activeLayers.riskZones, forest?.monitoredAois]);

  // Handle marker click
  const handleMarkerClick = (marker: MapMarker) => {
    let kind: SelectedPlace['kind'] = 'point';
    const idStr = String(marker.id);
    if (idStr.startsWith('aq-')) kind = 'air';
    else if (idStr.startsWith('fire-')) kind = 'fire';
    else if (idStr.startsWith('forest-') || idStr.startsWith('gfw-live-')) kind = 'forest';

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
              forest: (forest?.points?.length || 0) + (forest?.liveAlerts?.length || 0),
              riskZones: mapPolygons.length,
            }}
            liveStatuses={{
              fires: fires?.live,
              air: air?.live,
              forest: !!(forest?.liveAlerts && forest.liveAlerts.length > 0) || forest?.syncStatus?.status === 'success',
            }}
          />
        </div>

        {/* The Advanced Map Instance */}
        <div className="relative h-[380px] sm:h-[460px] lg:h-[560px] w-full min-w-0 rounded-xl overflow-hidden">
          <AdvancedMap
            center={[22.5, 82.0]} // Center of the Republic of India
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
              height: '100%',
              width: '100%',
            }}
          />
        </div>

        {/* Legend Bar */}
        <MapLegend />
      </div>

      {/* Selected Location Details Panel & AI Brief */}
      <div className="rounded-xl bg-[#14251C] border border-emerald-950/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-emerald-950/80 bg-[#0D1914] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[#F2F5F2]">
              Target Location Intelligence &amp; AI Briefing
            </h4>
          </div>
          <span className="text-[11px] font-mono text-[#9CAEA2]">Synchronous Buffer</span>
        </div>
        <PlacePanel place={activeSelected} fires={fires} forest={forest} />
      </div>
    </div>
  );
};

export default EnvironmentalMap;
