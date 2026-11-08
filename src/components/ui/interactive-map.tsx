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

// Custom marker icons
export const createCustomIcon = (
  color = "blue",
  size: "small" | "medium" | "large" = "medium",
  category?: string
) => {
  const sizes: Record<"small" | "medium" | "large", [number, number]> = {
    small: [20, 32],
    medium: [25, 41],
    large: [30, 50],
  };

  const actualColor = resolveColorName(color, category);

  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${actualColor}.png`,
    shadowUrl:
      "https://cdn.21st.dev/assets/mirror/26/264f5c640339f042dd729062cfc04c17f8ea0f29882b538e3848ed8f10edb4da.png",
    iconSize: sizes[size],
    iconAnchor: [sizes[size][0] / 2, sizes[size][1]],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
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
      map.flyTo(location, Math.max(map.getZoom(), 11), { duration: 1.2 });
    }
  }, [location, map]);
  return null;
};

// Invalidate size on mount / resize so tiles render edge-to-edge
const MapResizeHandler: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    const container = map.getContainer();
    if (!container || typeof ResizeObserver === 'undefined') {
      return () => clearTimeout(timer);
    }

    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(container);

    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [map]);
  return null;
};

// Custom control component
const CustomControls: React.FC<{
  onLocate: () => void;
  onToggleLayer: (layer: "satellite" | "traffic") => void;
  layers: { openstreetmap?: boolean; satellite?: boolean; traffic?: boolean };
}> = ({ onLocate, onToggleLayer, layers }) => {
  const map = useMap();

  useEffect(() => {
    const control = new L.Control({ position: "topright" });

    control.onAdd = () => {
      const div = L.DomUtil.create("div", "custom-controls");
      div.innerHTML = `
        <div style="background: rgba(13, 25, 20, 0.95); backdrop-filter: blur(8px); padding: 7px; border-radius: 9px; border: 1px solid rgba(16, 185, 129, 0.35); box-shadow: 0 4px 14px rgba(0,0,0,0.4); display: flex; flex-direction: column; gap: 5px;">
          <button id="locate-btn" style="margin: 2px; padding: 7px 12px; border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 6px; cursor: pointer; background: #142820; color: #a7f3d0; font-size: 14px; font-weight: 600; font-family: 'Lora', serif;">📍 Locate Me</button>
          <button id="satellite-btn" style="margin: 2px; padding: 7px 12px; border: 1px solid ${layers.satellite ? '#10b981' : 'rgba(16, 185, 129, 0.4)'}; border-radius: 6px; cursor: pointer; background: ${layers.satellite ? '#065f46' : '#142820'}; color: #a7f3d0; font-size: 14px; font-weight: 600; font-family: 'Lora', serif;">🛰️ Satellite</button>
          <button id="traffic-btn" style="margin: 2px; padding: 7px 12px; border: 1px solid ${layers.traffic ? '#10b981' : 'rgba(16, 185, 129, 0.4)'}; border-radius: 6px; cursor: pointer; background: ${layers.traffic ? '#065f46' : '#142820'}; color: #a7f3d0; font-size: 14px; font-weight: 600; font-family: 'Lora', serif;">🚦 OpenStreet</button>
        </div>
      `;

      L.DomEvent.disableClickPropagation(div);

      const locateBtn = div.querySelector("#locate-btn") as HTMLButtonElement | null;
      const satelliteBtn = div.querySelector("#satellite-btn") as HTMLButtonElement | null;
      const trafficBtn = div.querySelector("#traffic-btn") as HTMLButtonElement | null;

      if (locateBtn) locateBtn.onclick = () => onLocate();
      if (satelliteBtn) satelliteBtn.onclick = () => onToggleLayer("satellite");
      if (trafficBtn) trafficBtn.onclick = () => onToggleLayer("traffic");

      return div;
    };

    control.addTo(map);

    return () => {
      control.remove();
    };
  }, [map, onLocate, onToggleLayer, layers]);

  return null;
};

// Search component - pinned to the top-left corner
const SearchControl: React.FC<{
  onSearch?: (result: { latLng: [number, number]; name: string }) => void;
}> = ({ onSearch }) => {
  const map = useMap();
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  useEffect(() => {
    const control = new L.Control({ position: "topleft" });

    control.onAdd = () => {
      const div = L.DomUtil.create("div", "search-control");
      div.innerHTML = `
        <div style="background: rgba(13, 25, 20, 0.95); backdrop-filter: blur(8px); padding: 7px; border-radius: 9px; border: 1px solid rgba(16, 185, 129, 0.4); box-shadow: 0 4px 14px rgba(0,0,0,0.5); display: flex; gap: 7px; align-items: center; margin-top: 2px; margin-left: 2px;">
          <input 
            id="search-input" 
            type="text" 
            placeholder="Search places or coordinates..." 
            style="padding: 8px 12px; border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 6px; width: 220px; max-width: calc(100vw - 190px); background: #0A1712; color: #F2F5F2; font-size: 15px; font-family: 'Lora', serif; outline: none;"
          />
          <button 
            id="search-btn" 
            type="button"
            title="Search location"
            style="padding: 8px 14px; border: none; border-radius: 6px; cursor: pointer; background: #10b981; color: #022c22; font-size: 15px; font-weight: bold; font-family: 'Lora', serif; display: flex; align-items: center; justify-content: center;"
          >
            🔍
          </button>
        </div>
      `;

      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);

      const input = div.querySelector("#search-input") as HTMLInputElement | null;
      const button = div.querySelector("#search-btn") as HTMLButtonElement | null;

      const executeSearch = async () => {
        if (!input) return;
        const query = input.value.trim();
        if (!query) return;

        // Feedback: loading state
        if (button) button.innerHTML = "⏳";

        // Check if query is coordinates format "lat, lon"
        const coordMatch = query.match(/^([-+]?\d+(\.\d+)?)\s*,\s*([-+]?\d+(\.\d+)?)$/);
        if (coordMatch) {
          const lat = parseFloat(coordMatch[1]);
          const lon = parseFloat(coordMatch[3]);
          if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            const latLng: [number, number] = [lat, lon];
            map.flyTo(latLng, 13);
            if (onSearchRef.current) {
              onSearchRef.current({ latLng, name: `Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}` });
            }
            if (button) button.innerHTML = "🔍";
            return;
          }
        }

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
          );
          const results = await response.json();

          if (results && results.length > 0) {
            const { lat, lon, display_name } = results[0];
            const latLng: [number, number] = [parseFloat(lat), parseFloat(lon)];
            map.flyTo(latLng, 13);
            if (onSearchRef.current) {
              onSearchRef.current({ latLng, name: display_name });
            }
          } else {
            // Visual feedback: brief red outline
            input.style.borderColor = "#ef4444";
            input.placeholder = "Location not found...";
            setTimeout(() => {
              if (input) {
                input.style.borderColor = "rgba(16, 185, 129, 0.4)";
                input.placeholder = "Search places or coordinates...";
              }
            }, 2500);
          }
        } catch (error) {
          console.error("Search error:", error);
          if (input) {
            input.style.borderColor = "#ef4444";
            setTimeout(() => {
              if (input) input.style.borderColor = "rgba(16, 185, 129, 0.4)";
            }, 2000);
          }
        } finally {
          if (button) button.innerHTML = "🔍";
        }
      };

      if (input) {
        // Prevent Leaflet keyboard shortcuts from intercepting typing in search bar
        input.addEventListener("keydown", (e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            executeSearch();
          }
        });
        input.addEventListener("keyup", (e) => e.stopPropagation());
        input.addEventListener("keypress", (e) => e.stopPropagation());
      }

      if (button) {
        button.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          executeSearch();
        });
      }

      return div;
    };

    control.addTo(map);

    return () => {
      control.remove();
    };
  }, [map]);

  return null;
};

// Main AdvancedMap component
export const AdvancedMap: React.FC<AdvancedMapProps> = ({
  center = [51.505, -0.09],
  zoom = 13,
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

  // Handle geolocation
  const handleLocate = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
        },
        (error) => {
          console.error("Geolocation error:", error);
        }
      );
    }
  }, []);

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

  // Normalize polygons to support coordinates or positions
  const normalizedPolygons = useMemo(() => {
    return polygons.map((poly, index) => {
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
    });
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
    <div className={`advanced-map relative z-0 overflow-hidden ${className}`} style={style}>
      <MapContainer
        center={center}
        zoom={zoom}
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

        {/* Search control */}
        {enableSearch && (
          <SearchControl
            onSearch={(res) => {
              setSearchResult(res);
              if (onMapClick) {
                onMapClick({ lat: res.latLng[0], lon: res.latLng[1], lng: res.latLng[1] });
              }
            }}
          />
        )}

        {/* Custom controls */}
        {enableControls && (
          <CustomControls
            onLocate={handleLocate}
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
                    <div style={{ maxWidth: "min(320px, 85vw)", color: "#111", fontFamily: "'Lora', serif" }}>
                      {marker.popupObj.title && (
                        <h3 style={{ margin: "0 0 6px 0", fontSize: "17px", fontWeight: "bold", fontFamily: "'Lora', serif" }}>
                          {marker.popupObj.title}
                        </h3>
                      )}
                      {marker.popupObj.content && (
                        <p style={{ margin: "0 0 6px 0", fontSize: "15px", lineHeight: "1.5", fontFamily: "'Lora', serif" }}>
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
                        <div style={{ marginTop: "8px", borderTop: "1px solid #e5e7eb", paddingTop: "6px", fontSize: "13px", fontFamily: "'Lora', serif" }}>
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
                  <div style={{ maxWidth: "min(320px, 85vw)", color: "#111", fontFamily: "'Lora', serif" }}>
                    {marker.popupObj.title && (
                      <h3 style={{ margin: "0 0 6px 0", fontSize: "17px", fontWeight: "bold", fontFamily: "'Lora', serif" }}>
                        {marker.popupObj.title}
                      </h3>
                    )}
                    <p style={{ margin: "0 0 6px 0", fontSize: "15px", lineHeight: "1.5", fontFamily: "'Lora', serif" }}>
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

        {/* Clicked location marker */}
        {clickedLocation && (
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
