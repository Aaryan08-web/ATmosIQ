import type { FeatureCollection } from 'geojson';
import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(workerUrl);
import type { AqResult, DeforestationResult, FireResult, SelectedPlace } from '@/types';

export type LayerKey = 'fires' | 'air' | 'forest';

interface Props {
  fires: FireResult | null;
  air: AqResult | null;
  forest: DeforestationResult | null;
  visible: Record<LayerKey, boolean>;
  selected: SelectedPlace | null;
  onSelect: (place: SelectedPlace) => void;
  className?: string;
}

const EMPTY = { type: 'FeatureCollection', features: [] } as FeatureCollection;

const toFC = <T extends { lat: number; lon: number }>(items: T[] | undefined): FeatureCollection => ({
  type: 'FeatureCollection',
  features: (items ?? []).map((p) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    properties: { ...p },
  })),
});

const LAYERS: Record<LayerKey, string[]> = {
  fires: ['fires-heat', 'fires-pts'],
  air: ['air-pts'],
  forest: ['forest-pts'],
};

export function MapView({ fires, air, forest, visible, selected, onSelect, className }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const firesRef = useRef(fires);
  firesRef.current = fires;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  // Create the map once.
  useEffect(() => {
    if (!container.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: container.current,
        center: [30, 15],
        zoom: 1.6,
        minZoom: 1,
        attributionControl: { compact: true },
        style: {
          version: 8,
          projection: { type: 'globe' },
          sources: {
            base: {
              type: 'raster',
              tiles: ['a', 'b', 'c'].map((s) => `https://${s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png`),
              tileSize: 256,
              attribution: '© OpenStreetMap contributors © CARTO',
            },
          },
          layers: [
            { id: 'bg', type: 'background', paint: { 'background-color': '#0B1713' } },
            { id: 'base', type: 'raster', source: 'base' },
          ],
        },
      });
    } catch {
      setMapError(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      map.addSource('fires', { type: 'geojson', data: EMPTY });
      map.addSource('air', { type: 'geojson', data: EMPTY });
      map.addSource('forest', { type: 'geojson', data: EMPTY });

      map.addLayer({
        id: 'forest-pts', type: 'circle', source: 'forest',
        paint: {
          'circle-radius': ['match', ['get', 'severity'], 'Critical', 14, 'High', 11, 8],
          'circle-color': '#22c55e',
          'circle-opacity': 0.25,
          'circle-stroke-color': ['match', ['get', 'severity'], 'Critical', '#ef4444', 'High', '#f59e0b', '#a3e635'],
          'circle-stroke-width': 2,
        },
      });
      map.addLayer({
        id: 'air-pts', type: 'circle', source: 'air',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 5, 6, 12],
          'circle-color': [
            'step', ['coalesce', ['get', 'usAqi'], -1],
            '#64748b', 0, '#22c55e', 51, '#eab308', 101, '#f97316', 151, '#ef4444', 201, '#a855f7', 301, '#7f1d1d',
          ],
          'circle-stroke-color': '#0B1713',
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.92,
        },
      });
      map.addLayer({
        id: 'fires-heat', type: 'heatmap', source: 'fires', maxzoom: 7,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'frp'], 0, 0.2, 60, 1],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 1, 6, 6, 24],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 1, 0.8, 7, 2],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(249,115,22,0)', 0.3, 'rgba(249,115,22,0.5)', 0.6, 'rgba(239,68,68,0.8)', 1, 'rgba(254,240,138,1)',
          ],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.9, 7, 0],
        },
      });
      map.addLayer({
        id: 'fires-pts', type: 'circle', source: 'fires', minzoom: 5,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'frp'], 0, 3, 100, 9],
          'circle-color': '#f97316',
          'circle-stroke-color': '#fde68a',
          'circle-stroke-width': 1,
          'circle-opacity': 0.9,
        },
      });

      const pointer = (on: boolean) => () => (map.getCanvas().style.cursor = on ? 'pointer' : '');
      for (const id of ['fires-pts', 'air-pts', 'forest-pts']) {
        map.on('mouseenter', id, pointer(true));
        map.on('mouseleave', id, pointer(false));
      }
      setReady(true);
    });

    // Fire dots only render from zoom 5, but a click on the heatmap should still pick the nearest detection.
    const nearestFire = (e: maplibregl.MapMouseEvent) => {
      if (!visibleRef.current.fires || map.getZoom() >= 5) return null;
      let best: FireResult['points'][number] | null = null;
      let bestPx = 14; // click tolerance in screen pixels
      for (const p of firesRef.current?.points ?? []) {
        const px = map.project([p.lon, p.lat]);
        const d = Math.hypot(px.x - e.point.x, px.y - e.point.y);
        if (d < bestPx) {
          bestPx = d;
          best = p;
        }
      }
      return best;
    };

    map.on('click', (e) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: ['forest-pts', 'air-pts', 'fires-pts'].filter((l) => map.getLayer(l)) });
      const f = hits[0];
      const [lon, lat] = f?.geometry.type === 'Point' ? (f.geometry.coordinates as [number, number]) : [e.lngLat.lng, e.lngLat.lat];
      const p = (f?.properties ?? {}) as Record<string, string | number | null>;

      if (f?.layer.id === 'air-pts') {
        onSelectRef.current({
          name: `${p.name}, ${p.country}`, lat, lon, kind: 'air',
          details: [`US AQI ${p.usAqi ?? 'n/a'} · ${p.category}`, `PM2.5 ${p.pm25 ?? 'n/a'} µg/m³`],
        });
      } else if (f?.layer.id === 'forest-pts') {
        onSelectRef.current({
          name: String(p.name), lat, lon, kind: 'forest',
          details: [`${p.country} · ${p.biome}`, `Driver: ${p.driver}`, `Severity: ${p.severity}`],
        });
      } else if (f?.layer.id === 'fires-pts') {
        onSelectRef.current({
          name: 'Fire detection', lat, lon, kind: 'fire',
          details: [`Radiative power ${p.frp} MW`, `Detected ${p.acquired}`, `Satellite ${p.satellite}`],
        });
      } else if (!f && nearestFire(e)) {
        const fire = nearestFire(e)!;
        onSelectRef.current({
          name: 'Fire detection', lat: fire.lat, lon: fire.lon, kind: 'fire',
          details: [`Radiative power ${fire.frp} MW`, `Detected ${fire.acquired}`, `Satellite ${fire.satellite}`],
        });
      } else {
        onSelectRef.current({
          name: `Point ${lat.toFixed(2)}°, ${lon.toFixed(2)}°`, lat, lon, kind: 'point', details: [],
        });
      }
    });

    map.on('error', (e) => {
      // Tile failures are non-fatal; only surface a total init failure.
      if (!map.loaded() && !map.isStyleLoaded()) console.warn('[map]', e.error?.message);
    });

    return () => {
      markerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // The container height differs between Overview and Risk Map views; tell MapLibre to re-measure.
  useEffect(() => {
    mapRef.current?.resize();
  }, [className]);

  // Push data into sources.
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    (m.getSource('fires') as maplibregl.GeoJSONSource | undefined)?.setData(toFC(fires?.points));
    (m.getSource('air') as maplibregl.GeoJSONSource | undefined)?.setData(toFC(air?.points.filter((p) => p.usAqi != null)));
    (m.getSource('forest') as maplibregl.GeoJSONSource | undefined)?.setData(toFC(forest?.points));
  }, [ready, fires, air, forest]);

  // Layer visibility.
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    (Object.keys(LAYERS) as LayerKey[]).forEach((k) =>
      LAYERS[k].forEach((id) => m.getLayer(id) && m.setLayoutProperty(id, 'visibility', visible[k] ? 'visible' : 'none'))
    );
  }, [ready, visible]);

  // Marker + fly-to for selection.
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    markerRef.current?.remove();
    if (!selected) return;
    markerRef.current = new maplibregl.Marker({ color: '#00D6A0' }).setLngLat([selected.lon, selected.lat]).addTo(m);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    m.flyTo({ center: [selected.lon, selected.lat], zoom: Math.max(m.getZoom(), 4), duration: reduce ? 0 : 1400, essential: false });
  }, [ready, selected]);

  if (mapError) {
    return (
      <div className={`flex items-center justify-center bg-[#0B1713] text-xs text-[#9CAEA2] ${className ?? ''}`}>
        The map could not start in this browser (WebGL is required).
      </div>
    );
  }
  return <div ref={container} className={className} role="region" aria-label="Interactive environmental risk map" />;
}
