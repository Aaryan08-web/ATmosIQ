import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polygon,
  Polyline,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, MapPin, Satellite, Map as MapIcon, Loader2, X, AlertCircle } from "lucide-react";

// Fix for default markers in React-Leaflet
// @ts-expect-error - Leaflet private property deletion
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdn.21st.dev/assets/mirror/00/00179c4c1ee830d3a108412ae0d294f55776cfeb085c60129a39aa6fc4ae2528.png",
  iconUrl:
    "https://cdn.21st.dev/assets/mirror/57/574c3a5cca85f4114085b6841596d62f00d7c892c7b03f28cbfa301deb1dc437.png",
  shadowUrl:
    "https://cdn.21st.dev/assets/mirror/26/264f5c640339f042dd729062cfc04c17f8ea0f29882b538e3848ed8f10edb4da.png",
});

export interface MapMarkerPopup {
  title?: string;
  content?: string;
  image?: string;
}

export interface MapMeasurement {
  label: string;
  value: string | number;
  unit?: string;
}

export interface MapMarker {
  id?: string | number;
  position?: [number, number];
  lat?: number;
  lon?: number;
  title?: string;
  category?: 'low' | 'moderate' | 'high' | 'critical' | 'selected' | 'forest' | 'fire' | 'air';
  color?: string;
  size?: "small" | "medium" | "large";
  icon?: L.Icon | L.DivIcon;
  badge?: string;
  description?: string;
  popup?: string | MapMarkerPopup;
  measurements?: MapMeasurement[];
  source?: string;
  updatedAt?: string;
  raw?: unknown;
}

export interface MapPolygonStyle {
  color?: string;
  weight?: number;
  fillOpacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface MapPolygon {
  id?: string | number;
  name?: string;
  positions?: [number, number][];
  coordinates?: [number, number][][]; // GeoJSON [lon, lat] format
  style?: L.PathOptions | MapPolygonStyle;
  color?: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  popup?: string;
}

export interface MapCircle {
  id?: string | number;
  center: [number, number];
  radius?: number; // meters
  radiusKm?: number; // km
  style?: L.PathOptions;
  color?: string;
  popup?: string;
}

export interface MapPolyline {
  id?: string | number;
  positions: [number, number][];
  style?: L.PathOptions;
  popup?: string;
}

export interface AdvancedMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  polygons?: MapPolygon[];
  circles?: MapCircle[];
  polylines?: MapPolyline[];
  onMarkerClick?: (marker: MapMarker) => void;
  onMapClick?: (latlng: { lat: number; lon: number } | [number, number] | L.LatLng | any) => void;
  enableClustering?: boolean;
  enableSearch?: boolean;
  enableControls?: boolean;
  enableDrawing?: boolean;
  flyToLocation?: [number, number] | null;
  mapLayers?: {
    openstreetmap?: boolean;
    satellite?: boolean;
    traffic?: boolean;
  };
  className?: string;
  style?: React.CSSProperties;
}

// Color resolver for marker pins: ordinary fires are orange, critical fires/anomalies are red
export const resolveColorName = (color?: string, category?: string): string => {
  if (category === "critical") return "red";
  if (category === "fire") return "orange";
  if (category === "high") return "orange";
  if (category === "moderate") return "gold";
  if (category === "low") return "green";
  if (category === "forest") return "violet";
  if (category === "selected") return "blue";
  if (category === "air") return "green";

  if (!color) return "blue";
  const c = color.toLowerCase();
  if (c.includes("red") || c === "#ef4444") return "red";
  if (c.includes("orange") || c === "#f97316") return "orange";
  if (c.includes("yellow") || c.includes("gold") || c === "#eab308") return "gold";
  if (c.includes("green") || c === "#22c55e" || c === "#10b981") return "green";
  if (c.includes("purple") || c.includes("violet") || c === "#a855f7") return "violet";
  if (c.includes("grey") || c.includes("gray")) return "grey";
  if (c.includes("black")) return "black";
  return "blue";
};

// Custom marker icons with singleton instance caching to eliminate garbage collection stutters
const iconCache = new Map<string, L.Icon>();

export const createCustomIcon = (
  color = "blue",
  size: "small" | "medium" | "large" = "medium",
  category?: string
) => {
  const actualColor = resolveColorName(color, category);
  const cacheKey = `${actualColor}:${size}`;
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  const sizes: Record<"small" | "medium" | "large", [number, number]> = {
    small: [20, 32],
    medium: [25, 41],
    large: [30, 50],
  };

  const icon = new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${actualColor}.png`,
    shadowUrl:
      "https://cdn.21st.dev/assets/mirror/26/264f5c640339f042dd729062cfc04c17f8ea0f29882b538e3848ed8f10edb4da.png",
    iconSize: sizes[size],
    iconAnchor: [sizes[size][0] / 2, sizes[size][1]],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  iconCache.set(cacheKey, icon);
  return icon;
};

// Map event handler component
const MapEvents: React.FC<{
  onMapClick?: (latlng: L.LatLng) => void;
  onLocationFound?: (latlng: [number, number]) => void;
}> = ({ onMapClick, onLocationFound }) => {
  const map = useMapEvents({
    click: (e) => {
      onMapClick && onMapClick(e.latlng);
    },
    locationfound: (e) => {
      onLocationFound && onLocationFound([e.latlng.lat, e.latlng.lng]);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  return null;
};

// Camera flyTo controller
const MapFlyTo: React.FC<{ location?: [number, number] | null }> = ({ location }) => {
  const map = useMap();
  useEffect(() => {
    if (location && typeof location[0] === "number" && typeof location[1] === "number") {
      try {
        if (map && map.getContainer && map.getContainer()) {
          map.flyTo(location, Math.max(map.getZoom(), 11), { duration: 1.2 });
        }
      } catch {
        // safely ignore if map is unmounted or in transition
      }
    }
  }, [location, map]);
  return null;
};

// Invalidate size on mount / container resize / window resize so tiles render edge-to-edge
const MapResizeHandler: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const safeInvalidate = () => {
      try {
        if (map && map.getContainer && map.getContainer()) {
          map.invalidateSize();
        }
      } catch {
        // safely ignore if map is unmounted or container removed
      }
    };

    // Initial size invalidation after mounting
    const timer1 = setTimeout(safeInvalidate, 150);
    const timer2 = setTimeout(safeInvalidate, 500);

    const container = map.getContainer();
    let ro: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        safeInvalidate();
      });
      ro.observe(container);
    }

    const handleWindowResize = () => {
      safeInvalidate();
    };

    window.addEventListener('resize', handleWindowResize, { passive: true });
    window.addEventListener('orientationchange', handleWindowResize, { passive: true });

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('orientationchange', handleWindowResize);
    };
  }, [map]);
  return null;
};

interface MapFloatingToolbarProps {
  onSearch?: (result: { latLng: [number, number]; name: string }) => void;
  onLocate: () => void;
  isLocating: boolean;
  locateError: string | null;
  onToggleLayer: (layer: "satellite" | "traffic") => void;
  layers: { openstreetmap?: boolean; satellite?: boolean; traffic?: boolean };
}

// Compact Floating Map Toolbar (Search, Locate, Satellite, Street)
const MapFloatingToolbar: React.FC<MapFloatingToolbarProps> = ({
  onSearch,
  onLocate,
  isLocating,
  locateError,
  onToggleLayer,
  layers,
}) => {
  const map = useMap();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ name: string; lat: number; lon: number }>>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (toolbarRef.current) {
      L.DomEvent.disableClickPropagation(toolbarRef.current);
      L.DomEvent.disableScrollPropagation(toolbarRef.current);
    }
  }, []);

  // Auto-focus input when search expands
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Click outside listener
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Escape key listener
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSearchOpen(false);
        setSuggestions([]);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const handleSelectResult = (item: { name: string; lat: number; lon: number }) => {
    map.flyTo([item.lat, item.lon], 12);
    if (onSearch) {
      onSearch({ latLng: [item.lat, item.lon], name: item.name });
    }
    setIsSearchOpen(false);
    setSuggestions([]);
    setSearchQuery("");
  };

  const executeSearch = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? searchQuery).trim();
    if (!q) return;

    // Check coordinates "lat, lon"
    const coordMatch = q.match(/^([-+]?\d+(\.\d+)?)\s*,\s*([-+]?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[3]);
      if (!isNaN(lat) && !isNaN(lon)) {
        if (lat >= 6.5 && lat <= 37.5 && lon >= 68.0 && lon <= 97.5) {
          handleSelectResult({
            name: `Indian Coordinates (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E)`,
            lat,
            lon,
          });
          return;
        } else {
          setSearchError("Coordinates fall outside India (6.5°–37.5°N, 68.0°–97.5°E).");
          setTimeout(() => setSearchError(null), 3500);
          return;
        }
      }
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=5&q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const results = data.map((d: any) => ({
          name: d.display_name,
          lat: parseFloat(d.lat),
          lon: parseFloat(d.lon),
        }));
        setSuggestions(results);
        if (overrideQuery === undefined) {
          handleSelectResult(results[0]);
        }
      } else {
        setSearchError("No locations found in India.");
        setTimeout(() => setSearchError(null), 3500);
      }
    } catch {
      setSearchError("Search service temporarily unavailable.");
      setTimeout(() => setSearchError(null), 3500);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div
      ref={toolbarRef}
      className="absolute top-3 right-3 z-[1000] flex flex-col items-end gap-1.5"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {/* Floating Toolbar Pill */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0B1713]/95 backdrop-blur-md border border-emerald-900/60 shadow-xl shadow-black/50">
        {/* Search Control */}
        {isSearchOpen ? (
          <div className="flex items-center gap-1.5 bg-[#07120E] border border-emerald-500/70 rounded-lg px-2.5 py-1 shadow-inner transition-all duration-300 w-52 min-[420px]:w-64 sm:w-72">
            <Search className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                if (val.length > 2) {
                  fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=4&q=${encodeURIComponent(val)}`
                  )
                    .then((r) => r.json())
                    .then((data) => {
                      if (Array.isArray(data)) {
                        setSuggestions(
                          data.map((d: any) => ({
                            name: d.display_name,
                            lat: parseFloat(d.lat),
                            lon: parseFloat(d.lon),
                          }))
                        );
                      }
                    })
                    .catch(() => {});
                } else {
                  setSuggestions([]);
                }
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  executeSearch();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setIsSearchOpen(false);
                  setSuggestions([]);
                }
              }}
              placeholder="Search Indian cities or locations..."
              className="w-full bg-transparent text-xs text-[#F2F5F2] placeholder-[#82978B] outline-none font-sans"
            />
            {isSearching ? (
              <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSuggestions([]);
                }}
                className="text-[#9CAEA2] hover:text-[#F2F5F2] p-0.5 cursor-pointer"
                title="Clear input"
                aria-label="Clear search input"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(false);
                setSuggestions([]);
              }}
              title="Close search (Esc)"
              aria-label="Close search"
              className="text-[#9CAEA2] hover:text-[#F2F5F2] text-[11px] font-mono px-1 border-l border-emerald-950/80 ml-0.5 cursor-pointer"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            title="Search Indian cities or coordinates"
            aria-label="Search Indian cities or coordinates"
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#101F18]/90 hover:bg-[#174C34] text-[#CBDAD0] hover:text-[#F2F5F2] border border-emerald-900/60 transition-all cursor-pointer shadow-sm"
          >
            <Search className="w-4 h-4 text-emerald-400" />
          </button>
        )}

        {/* Locate Me Button */}
        <button
          type="button"
          onClick={onLocate}
          disabled={isLocating}
          title="Locate current position"
          aria-label="Locate current position"
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#101F18]/90 hover:bg-[#174C34] text-[#CBDAD0] hover:text-[#F2F5F2] border border-emerald-900/60 transition-all cursor-pointer shadow-sm disabled:opacity-60"
        >
          {isLocating ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          ) : (
            <MapPin className="w-4 h-4 text-emerald-400" />
          )}
        </button>

        {/* Satellite Layer Toggle */}
        <button
          type="button"
          onClick={() => onToggleLayer("satellite")}
          title="Satellite Imagery Layer"
          aria-label="Toggle satellite layer"
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer shadow-sm ${
            layers.satellite
              ? "bg-[#174C34] border-emerald-400 text-emerald-300 ring-1 ring-emerald-500/50"
              : "bg-[#101F18]/90 hover:bg-[#174C34] text-[#CBDAD0] hover:text-[#F2F5F2] border-emerald-900/60 border"
          }`}
        >
          <Satellite className="w-4 h-4" />
        </button>

        {/* Street Map Layer Toggle */}
        <button
          type="button"
          onClick={() => onToggleLayer("traffic")}
          title="Street Map Layer"
          aria-label="Toggle street map layer"
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer shadow-sm ${
            !layers.satellite
              ? "bg-[#174C34] border-emerald-400 text-emerald-300 ring-1 ring-emerald-500/50"
              : "bg-[#101F18]/90 hover:bg-[#174C34] text-[#CBDAD0] hover:text-[#F2F5F2] border-emerald-900/60 border"
          }`}
        >
          <MapIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Suggestions Dropdown */}
      {isSearchOpen && suggestions.length > 0 && (
        <div className="w-64 sm:w-72 max-w-[calc(100vw-32px)] rounded-xl bg-[#0B1713]/98 backdrop-blur-md border border-emerald-900/80 shadow-2xl overflow-hidden py-1 divide-y divide-emerald-950/60 z-[1001]">
          {suggestions.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectResult(item)}
              className="w-full text-left px-3 py-2 text-xs text-[#CBDAD0] hover:bg-[#14251C] hover:text-[#F2F5F2] transition-colors flex items-center gap-2 cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">{item.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Error Toast */}
      {(locateError || searchError) && (
        <div className="bg-red-950/95 backdrop-blur-md border border-red-800/80 text-red-300 text-xs px-3 py-1.5 rounded-lg shadow-xl flex items-center gap-1.5 max-w-xs animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="leading-tight">{locateError || searchError}</span>
        </div>
      )}
    </div>
  );
};

// Main AdvancedMap component
export const AdvancedMap: React.FC<AdvancedMapProps> = ({
  center = [22.5, 82.0], // Centered over India
  zoom = 5,
  markers = [],
  polygons = [],
  circles = [],
  polylines = [],
  onMarkerClick,
  onMapClick,
  enableClustering = true,
  enableSearch = true,
  enableControls = true,
  flyToLocation,
  mapLayers = {
    openstreetmap: true,
    satellite: false,
    traffic: false,
  },
  className = "",
  style = { height: "500px", width: "100%" },
}) => {
  const [currentLayers, setCurrentLayers] = useState(mapLayers);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [searchResult, setSearchResult] = useState<{ latLng: [number, number]; name: string } | null>(null);
  const [clickedLocation, setClickedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  // Handle layer toggling
  const handleToggleLayer = useCallback((layerType: "satellite" | "traffic") => {
    setCurrentLayers((prev) => {
      if (layerType === "satellite") {
        return {
          ...prev,
          satellite: !prev.satellite,
          openstreetmap: prev.satellite, // toggle between satellite and street
        };
      }
      return {
        ...prev,
        [layerType]: !prev[layerType],
      };
    });
  }, []);

  // Handle geolocation with India bounds check and error feedback
  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocateError("Geolocation is not supported by your browser.");
      setTimeout(() => setLocateError(null), 3500);
      return;
    }

    setIsLocating(true);
    setLocateError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        if (latitude >= 6.5 && latitude <= 37.5 && longitude >= 68.0 && longitude <= 97.5) {
          const coords: [number, number] = [latitude, longitude];
          setUserLocation(coords);
          if (onMapClick) {
            onMapClick({ lat: latitude, lon: longitude, lng: longitude });
          }
        } else {
          setLocateError(`Location (${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°) is outside India boundary.`);
          setTimeout(() => setLocateError(null), 4000);
        }
      },
      (err) => {
        setIsLocating(false);
        const msg = err.code === 1 ? "Location permission denied by user." : "Could not determine your location.";
        setLocateError(msg);
        setTimeout(() => setLocateError(null), 3500);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [onMapClick]);

  // Handle map click
  const handleMapClickInternal = useCallback(
    (latlng: L.LatLng) => {
      setClickedLocation({ lat: latlng.lat, lng: latlng.lng });
      if (onMapClick) {
        onMapClick({ lat: latlng.lat, lon: latlng.lng, lng: latlng.lng });
      }
    },
    [onMapClick]
  );

  // Normalize and validate markers to always have valid geographic [lat, lon]
  const normalizedMarkers = useMemo(() => {
    return markers
      .filter((marker) => {
        const lat = marker.position ? marker.position[0] : marker.lat;
        const lon = marker.position ? marker.position[1] : marker.lon;
        return (
          typeof lat === "number" &&
          typeof lon === "number" &&
          !isNaN(lat) &&
          !isNaN(lon) &&
          lat >= -90 &&
          lat <= 90 &&
          lon >= -180 &&
          lon <= 180
        );
      })
      .map((marker, index) => {
        const pos: [number, number] = marker.position
          ? marker.position
          : [marker.lat!, marker.lon!];

        let popupObj: MapMarkerPopup | undefined;
        if (typeof marker.popup === "object" && marker.popup !== null) {
          popupObj = marker.popup;
        } else if (typeof marker.popup === "string") {
          popupObj = { title: marker.title || "Feature Details", content: marker.popup };
        } else if (marker.description) {
          popupObj = { title: marker.title || "Telemetry Point", content: marker.description };
        }

        return {
          ...marker,
          id: marker.id || index,
          position: pos,
          resolvedColor: resolveColorName(marker.color, marker.category),
          popupObj,
        };
      });
  }, [markers]);

  // Normalize polygons to support coordinates or positions, filtering invalid polygons
  const normalizedPolygons = useMemo(() => {
    return polygons
      .map((poly, index) => {
        let positions: [number, number][] = poly.positions || [];
        if ((!positions || positions.length === 0) && poly.coordinates && poly.coordinates[0]) {
          // GeoJSON [lon, lat] -> [lat, lon]
          positions = poly.coordinates[0].map(([lon, lat]) => [lat, lon]);
        }
        return {
          ...poly,
          id: poly.id || index,
          positions,
        };
      })
      .filter((poly) => Array.isArray(poly.positions) && poly.positions.length >= 3);
  }, [polygons]);

  // Normalize circles to support radius or radiusKm
  const normalizedCircles = useMemo(() => {
    return circles.map((circle, index) => {
      const radius = circle.radius || (circle.radiusKm ? circle.radiusKm * 1000 : 500);
      return {
        ...circle,
        id: circle.id || index,
        radius,
      };
    });
  }, [circles]);

  return (
    <div className={`advanced-map relative z-0 overflow-hidden ${className}`} style={{ ...style, isolation: 'isolate' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        minZoom={4}
        maxBounds={[[4.0, 64.0], [40.0, 102.0]]}
        maxBoundsViscosity={0.7}
        zoomControl={false}
        style={{ height: "100%", width: "100%", background: "#0B1713" }}
        scrollWheelZoom={true}
      >
        <ZoomControl position="bottomleft" />
        <MapResizeHandler />
        <MapFlyTo location={flyToLocation} />

        {/* Base tile layers */}
        {currentLayers.openstreetmap && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}

        {currentLayers.satellite && (
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}

        {/* Map events */}
        <MapEvents
          onMapClick={handleMapClickInternal}
          onLocationFound={(loc) => setUserLocation(loc)}
        />

        {/* Compact Floating Map Toolbar (Search, Locate, Satellite, Street) */}
        {enableControls && (
          <MapFloatingToolbar
            onSearch={
              enableSearch
                ? (res) => {
                    setSearchResult(res);
                    if (onMapClick) {
                      onMapClick({ lat: res.latLng[0], lon: res.latLng[1], lng: res.latLng[1] });
                    }
                  }
                : undefined
            }
            onLocate={handleLocate}
            isLocating={isLocating}
            locateError={locateError}
            onToggleLayer={handleToggleLayer}
            layers={currentLayers}
          />
        )}

        {/* Markers with clustering */}
        {enableClustering ? (
          <MarkerClusterGroup chunkedLoading>
            {normalizedMarkers.map((marker) => (
              <Marker
                key={marker.id}
                position={marker.position}
                icon={marker.icon || createCustomIcon(marker.resolvedColor, marker.size || "medium", marker.category)}
                eventHandlers={{
                  click: () => onMarkerClick && onMarkerClick(marker),
                }}
              >
                {marker.popupObj && (
                  <Popup>
                    <div style={{ maxWidth: "min(320px, 85vw)", color: "#111", fontFamily: "var(--font-sans)" }}>
                      {marker.popupObj.title && (
                        <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: "bold", fontFamily: "var(--font-sans)" }}>
                          {marker.popupObj.title}
                        </h3>
                      )}
                      {marker.popupObj.content && (
                        <p style={{ margin: "0 0 6px 0", fontSize: "14px", lineHeight: "1.5", fontFamily: "var(--font-sans)" }}>
                          {marker.popupObj.content}
                        </p>
                      )}
                      {marker.popupObj.image && (
                        <img
                          src={marker.popupObj.image}
                          alt={marker.popupObj.title || "Marker image"}
                          style={{
                            maxWidth: "100%",
                            height: "auto",
                            borderRadius: "6px",
                            display: "block",
                            marginTop: "6px",
                          }}
                        />
                      )}
                      {marker.measurements && marker.measurements.length > 0 && (
                        <div style={{ marginTop: "8px", borderTop: "1px solid #e5e7eb", paddingTop: "6px", fontSize: "13px", fontFamily: "var(--font-sans)" }}>
                          {marker.measurements.map((m, idx) => (
                            <div key={idx} style={{ display: "flex", justifyContent: "space-between", margin: "3px 0" }}>
                              <span style={{ color: "#6b7280" }}>{m.label}:</span>
                              <span style={{ fontWeight: 600 }}>{m.value} {m.unit || ""}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Popup>
                )}
              </Marker>
            ))}
          </MarkerClusterGroup>
        ) : (
          normalizedMarkers.map((marker) => (
            <Marker
              key={marker.id}
              position={marker.position}
              icon={marker.icon || createCustomIcon(marker.resolvedColor, marker.size || "medium", marker.category)}
              eventHandlers={{
                click: () => onMarkerClick && onMarkerClick(marker),
              }}
            >
              {marker.popupObj && (
                <Popup>
                  <div style={{ maxWidth: "min(300px, 80vw)", color: "#111", fontFamily: "var(--font-sans)" }}>
                    {marker.popupObj.title && (
                      <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: "bold", fontFamily: "var(--font-sans)" }}>
                        {marker.popupObj.title}
                      </h3>
                    )}
                    <p style={{ margin: "0 0 4px 0", fontSize: "14px", lineHeight: "1.5", fontFamily: "var(--font-sans)" }}>
                      {marker.popupObj.content}
                    </p>
                    {marker.popupObj.image && (
                      <img
                        src={marker.popupObj.image}
                        alt={marker.popupObj.title || "Marker image"}
                        style={{ maxWidth: "100%", height: "auto", borderRadius: "6px" }}
                      />
                    )}
                  </div>
                </Popup>
              )}
            </Marker>
          ))
        )}

        {/* User location marker */}
        {userLocation && (
          <Marker position={userLocation} icon={createCustomIcon("red", "medium")}>
            <Popup>Your current location</Popup>
          </Marker>
        )}

        {/* Search result marker */}
        {searchResult && (
          <Marker position={searchResult.latLng} icon={createCustomIcon("green", "large")}>
            <Popup>{searchResult.name}</Popup>
          </Marker>
        )}

        {/* Clicked location marker (rendered only if target is not already marked by a selected pin) */}
        {clickedLocation && !normalizedMarkers.some((m) => m.category === 'selected') && (
          <Marker
            position={[clickedLocation.lat, clickedLocation.lng]}
            icon={createCustomIcon("orange", "small")}
          >
            <Popup>
              Lat: {clickedLocation.lat.toFixed(6)}
              <br />
              Lng: {clickedLocation.lng.toFixed(6)}
            </Popup>
          </Marker>
        )}

        {/* Polygons */}
        {normalizedPolygons.map((polygon) => (
          <Polygon
            key={polygon.id}
            positions={polygon.positions}
            pathOptions={
              (polygon.style as L.PathOptions) || {
                color: polygon.color || "green",
                weight: polygon.strokeWidth || 2,
                fillColor: polygon.color || "green",
                fillOpacity: polygon.fillOpacity || 0.35,
              }
            }
          >
            {polygon.popup && <Popup>{polygon.popup}</Popup>}
          </Polygon>
        ))}

        {/* Circles */}
        {normalizedCircles.map((circle) => (
          <Circle
            key={circle.id}
            center={circle.center}
            radius={circle.radius}
            pathOptions={
              circle.style || {
                color: circle.color || "purple",
                fillColor: circle.color || "purple",
                fillOpacity: 0.25,
                weight: 2,
              }
            }
          >
            {circle.popup && <Popup>{circle.popup}</Popup>}
          </Circle>
        ))}

        {/* Polylines */}
        {polylines.map((polyline, index) => (
          <Polyline
            key={polyline.id || index}
            positions={polyline.positions}
            pathOptions={polyline.style || { color: "red", weight: 3 }}
          >
            {polyline.popup && <Popup>{polyline.popup}</Popup>}
          </Polyline>
        ))}
      </MapContainer>
    </div>
  );
};

export default AdvancedMap;
