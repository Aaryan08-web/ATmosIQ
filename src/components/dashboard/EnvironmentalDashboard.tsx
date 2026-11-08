import React, { useMemo, useState, useCallback } from 'react';
import {
  Globe,
  Map as MapIcon,
  Flame,
  Wind,
  TreeDeciduous,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Search,
  Bell,
  Sparkles,
  Database,
  Target,
  Settings,
  Layers,
  CheckCircle2,
  Navigation,
  Leaf,
  Menu,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { motion } from 'framer-motion';

import type {
  AqResult,
  DeforestationResult,
  FireResult,
  Overview,
  SelectedPlace,
  User,
} from '@/types';
import { BackButton } from '@/components/ui/back-button';
import { useApi } from '@/lib/useApi';
import { PlacePanel } from '@/features/dashboard/PlacePanel';
import { AnimatedNumber } from '@/features/dashboard/AnimatedNumber';
import {
  AdvancedMap,
  type MapMarker,
  type MapPolygon,
  type MapCircle,
} from '@/components/ui/interactive-map';
import {
  Sidebar,
  SidebarBody,
  SidebarLink,
} from '@/components/ui/sidebar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

import {
  app1Chart,
  app1ChartConfig,
} from '@/components/ui/app-1-utils/app-1-data';

interface Props {
  user: User;
  onLogout: () => void;
  activeView?: 'dashboard' | 'map';
  onNavigate: (route: string) => void;
}

const AQI_LEGEND = [
  ['#22c55e', 'Good'],
  ['#eab308', 'Moderate'],
  ['#f97316', 'Sensitive'],
  ['#ef4444', 'Unhealthy'],
  ['#a855f7', 'Very unhealthy'],
  ['#7f1d1d', 'Hazardous'],
] as const;

const fmtTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export const EnvironmentalDashboard: React.FC<Props> = ({
  user,
  onLogout,
  activeView = 'dashboard',
  onNavigate,
}) => {
  const isMap = activeView === 'map';

  // State for hover-expand sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Telemetry APIs
  const overview = useApi<Overview>('/overview');
  const fires = useApi<FireResult>('/fires');
  const air = useApi<AqResult>('/air-quality');
  const forest = useApi<DeforestationResult>('/deforestation');

  // Map state
  const [showDemoLayer, setShowDemoLayer] = useState(true);
  const [visibleTelemetry, setVisibleTelemetry] = useState({
    fires: true,
    air: true,
    forest: true,
  });

  const [mapCenter, setMapCenter] = useState<[number, number]>([28.6139, 77.2090]);
  const [mapZoom, setMapZoom] = useState<number>(12);
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);

  // Selected place for AI briefing panel
  const [selected, setSelected] = useState<SelectedPlace | null>({
    name: 'Delhi NCR Central Environmental Observatory',
    lat: 28.6139,
    lon: 77.2090,
    kind: 'point',
    details: [
      'National Capital Region, India · Prime Atmospheric Sensor Hub',
      'Air quality telemetry active via CAMS South Asia model & CPCB ground array',
      'Delhi Central Ridge ecological reserve bounded within 3.5 km',
    ],
  });

  // User provided Demo Markers (India Demo Cities)
  const [demoMarkers] = useState<MapMarker[]>([
    {
      id: 1,
      position: [28.6139, 77.2090],
      color: 'blue',
      size: 'large',
      popup: {
        title: 'New Delhi Central Observatory',
        content: 'National Capital Region, India · Prime Atmospheric Sensor Hub',
        image:
          'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=600&q=80',
      },
    },
    {
      id: 2,
      position: [28.6315, 77.2167],
      color: 'red',
      size: 'medium',
      popup: {
        title: 'Connaught Place Station',
        content: 'Urban commercial center & high-density PM2.5 monitor',
      },
    },
    {
      id: 3,
      position: [18.5204, 73.8567],
      color: 'green',
      size: 'medium',
      popup: {
        title: 'Pune Research Station',
        content: 'Western Ghats Bio-Monitoring Node · JSPM JSCOE Research Center',
      },
    },
  ]);

  // User provided Demo Polygons (Delhi Ridge Ecological Reserve)
  const demoPolygons: MapPolygon[] = useMemo(
    () => [
      {
        id: 1,
        name: 'Delhi Central Ridge Reserve',
        positions: [
          [28.625, 77.175],
          [28.610, 77.165],
          [28.595, 77.185],
          [28.615, 77.195],
        ],
        style: { color: 'green', weight: 2, fillOpacity: 0.35 },
        popup: 'Delhi Central Ridge Ecological Reserve',
      },
    ],
    []
  );

  // User provided Demo Circles (NCR Urban Microclimate & AQI dispersion buffer)
  const demoCircles: MapCircle[] = useMemo(
    () => [
      {
        id: 1,
        center: [28.6139, 77.2090],
        radius: 2500,
        style: { color: 'purple', fillOpacity: 0.25 },
        popup: '2.5 km NCR Air Quality High-Precision Dispersion Zone',
      },
    ],
    []
  );

  // Callbacks provided by user
  const handleMarkerClick = (marker: MapMarker) => {
    console.log('Marker clicked:', marker);
    let title = marker.title || 'Selected Feature';
    let details: string[] = [];

    if (typeof marker.popup === 'object' && marker.popup !== null) {
      if (marker.popup.title) title = marker.popup.title;
      if (marker.popup.content) details.push(marker.popup.content);
    } else if (typeof marker.popup === 'string') {
      details.push(marker.popup);
    } else if (marker.description) {
      details.push(marker.description);
    }

    if (marker.measurements && marker.measurements.length > 0) {
      details.push(...marker.measurements.map((m) => `${m.label}: ${m.value} ${m.unit || ''}`));
    }

    const lat = marker.position ? marker.position[0] : (marker.lat ?? 0);
    const lon = marker.position ? marker.position[1] : (marker.lon ?? 0);

    setSelected({
      name: title,
      lat,
      lon,
      kind: 'point',
      details: details.length > 0 ? details : ['Interactive Map Feature point.'],
    });
  };

  const handleMapClick = (latlng: { lat: number; lon: number } | [number, number]) => {
    console.log('Map clicked at:', latlng);
    const lat = Array.isArray(latlng) ? latlng[0] : latlng.lat;
    const lon = Array.isArray(latlng) ? latlng[1] : latlng.lon;

    setSelected({
      name: `Point ${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E`,
      lat,
      lon,
      kind: 'point',
      details: ['Manual point selection on interactive map.'],
    });
  };

  // Combine demo markers and live environmental telemetry markers
  const combinedMarkers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];

    // 1. Demo markers
    if (showDemoLayer) {
      list.push(...demoMarkers);
    }

    // 2. Air quality markers
    if (visibleTelemetry.air && air.data?.points) {
      air.data.points.forEach((p, i) => {
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
        }

        list.push({
          id: `aq-${i}-${p.name}`,
          lat: p.lat,
          lon: p.lon,
          title: `${p.name}, ${p.country}`,
          category: cat,
          color,
          badge: `${p.usAqi ?? 'n/a'} AQI`,
          description: `US AQI: ${p.usAqi ?? 'n/a'} (${p.category}). PM2.5: ${p.pm25 ?? 'n/a'} µg/m³.`,
          measurements: [
            { label: 'US AQI', value: p.usAqi ?? 'n/a' },
            { label: 'PM2.5', value: p.pm25 ?? 'n/a', unit: 'µg/m³' },
            { label: 'Category', value: p.category },
          ],
          source: 'Open-Meteo / CAMS',
        });
      });
    }

    // 3. Fire anomalies
    if (visibleTelemetry.fires && fires.data?.points) {
      fires.data.points.forEach((p, i) => {
        list.push({
          id: `fire-${i}`,
          lat: p.lat,
          lon: p.lon,
          title: 'Satellite Fire Thermal Anomaly',
          category: p.frp > 80 ? 'critical' : 'fire',
          color: p.frp > 80 ? '#ef4444' : '#f97316',
          badge: `${Math.round(p.frp)} MW`,
          description: `Detected by ${p.satellite} VIIRS. Confidence: ${p.confidence}.`,
          measurements: [
            { label: 'Power', value: Math.round(p.frp), unit: 'MW' },
            { label: 'Sensor', value: p.satellite },
            { label: 'Pass', value: p.daynight === 'D' ? 'Day' : 'Night' },
          ],
          source: 'NASA FIRMS VIIRS',
        });
      });
    }

    // 4. Forest loss hotspots
    if (visibleTelemetry.forest && forest.data?.points) {
      forest.data.points.forEach((p) => {
        list.push({
          id: `forest-${p.id}`,
          lat: p.lat,
          lon: p.lon,
          title: `${p.name} (${p.country})`,
          category: 'forest',
          color: '#a855f7',
          badge: `${p.severity} Loss`,
          description: `Driver: ${p.driver}. Biome: ${p.biome}.`,
          measurements: [
            { label: 'Driver', value: p.driver },
            { label: 'Biome', value: p.biome },
            { label: 'Severity', value: p.severity },
          ],
          source: 'Global Forest Watch',
        });
      });
    }

    // 5. Selected location marker (if not already represented)
    if (selected) {
      list.push({
        id: 'selected-user-pin',
        lat: selected.lat,
        lon: selected.lon,
        title: selected.name,
        category: 'selected',
        color: '#3b82f6',
        badge: 'Selected Target',
        description: `Coordinates: ${selected.lat.toFixed(3)}°N, ${selected.lon.toFixed(3)}°E`,
        source: 'Target Selection',
      });
    }

    return list;
  }, [showDemoLayer, demoMarkers, visibleTelemetry, air.data, fires.data, forest.data, selected]);

  // Combine polygons
  const combinedPolygons = useMemo<MapPolygon[]>(() => {
    const list: MapPolygon[] = [];
    if (showDemoLayer) {
      list.push(...demoPolygons);
    }
    // Cerrado buffer
    list.push({
      id: 'cerrado-zone',
      name: 'Cerrado Forest Risk Zone',
      coordinates: [
        [
          [-50.5, -14.0],
          [-46.0, -14.0],
          [-46.0, -11.0],
          [-50.5, -11.0],
          [-50.5, -14.0],
        ],
      ],
      color: '#f97316',
      fillOpacity: 0.12,
      strokeColor: '#fb923c',
      strokeWidth: 1.5,
      popup: 'Cerrado High Deforestation Pressure Zone',
    });
    return list;
  }, [showDemoLayer, demoPolygons]);

  // Combine circles
  const combinedCircles = useMemo<MapCircle[]>(() => {
    const list: MapCircle[] = [];
    if (showDemoLayer) {
      list.push(...demoCircles);
    }
    if (selected) {
      list.push({
        id: 'selected-radius-circle',
        center: [selected.lat, selected.lon],
        radiusKm: 15,
        color: '#3b82f6',
        style: { color: '#3b82f6', fillOpacity: 0.12 },
        popup: '15 km Proximity Buffer',
      });
    }
    return list;
  }, [showDemoLayer, demoCircles, selected]);

  const ov = overview.data;
  const anyError = overview.error || fires.error || air.error || forest.error;
  const retryAll = () => {
    overview.retry();
    fires.retry();
    air.retry();
    forest.retry();
  };

  // Preset location quick jumps
  const handleJumpTo = (name: string, lat: number, lon: number, zoom = 13) => {
    setFlyToCoords([lat, lon]);
    setMapCenter([lat, lon]);
    setMapZoom(zoom);
  };

  // Sidebar navigation links
  const sidebarLinks = [
    {
      label: 'Overview',
      to: '/dashboard',
      icon: <Globe className="w-6 h-6 text-emerald-400 shrink-0" strokeWidth={2} />,
      active: activeView === 'dashboard',
    },
    {
      label: 'Risk Map',
      to: '/map',
      icon: <MapIcon className="w-6 h-6 text-emerald-400 shrink-0" strokeWidth={2} />,
      active: activeView === 'map',
    },
    {
      label: 'Atmospheric',
      to: '/dashboard',
      icon: <Wind className="w-6 h-6 text-emerald-400 shrink-0" strokeWidth={2} />,
      onClick: () => {
        handleJumpTo('Delhi NCR', 28.6139, 77.209, 8);
        onNavigate('/dashboard');
      },
    },
    {
      label: 'AI Forecast',
      to: '/dashboard',
      icon: <Sparkles className="w-6 h-6 text-emerald-400 shrink-0" strokeWidth={2} />,
      badge: 'Neural',
    },
    {
      label: 'Alerts & Events',
      to: '/dashboard',
      icon: <AlertTriangle className="w-6 h-6 text-emerald-400 shrink-0" strokeWidth={2} />,
      badge: 'Live',
    },
    {
      label: 'Interventions',
      to: '/dashboard',
      icon: <Target className="w-6 h-6 text-emerald-400 shrink-0" strokeWidth={2} />,
    },
    {
      label: 'Data Sources',
      to: '/dashboard',
      icon: <Database className="w-6 h-6 text-emerald-400 shrink-0" strokeWidth={2} />,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0B1713] text-[#F2F5F2] flex flex-col md:flex-row dashboard-root font-lora selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* 
        Expandable Hover Sidebar Component
        On hover: smoothly expands from 76px to 315px.
        On leave: collapses to 76px (icons only).
        On mobile: provides mobile drawer.
      */}
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} animate={true}>
        <SidebarBody className="justify-between gap-6 border-r border-emerald-950/80 bg-[#0D1914]">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {/* Header Brand with Leaf Emblem - centered when collapsed */}
            <div className="w-full h-12 flex items-center overflow-hidden mb-4 border-b border-emerald-950/80 pb-2">
              <div className="w-12 h-12 shrink-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#174C34] via-[#103323] to-[#0A1F16] border border-emerald-500/60 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.25)]">
                  <Leaf className="w-5 h-5 text-emerald-400 fill-emerald-500/40 -rotate-12" />
                </div>
              </div>
              <motion.div
                initial={false}
                animate={{
                  opacity: sidebarOpen ? 1 : 0,
                }}
                transition={{
                  duration: sidebarOpen ? 0.22 : 0.12,
                  ease: "easeInOut",
                }}
                className="flex-1 flex flex-col justify-center min-w-0 pr-3 overflow-hidden whitespace-nowrap !p-0 !m-0"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-extrabold tracking-tight text-[#F2F5F2]">ATmosIQ</span>
                  <Leaf className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/40 shrink-0" />
                </div>
                <div className="text-[10px] font-mono tracking-widest text-[#9CAEA2] uppercase font-semibold mt-0.5">
                  ENVIRONMENTAL INTEL
                </div>
              </motion.div>
            </div>

            {/* Nav items */}
            <div className="flex flex-col gap-1.5">
              {sidebarLinks.map((link, idx) => (
                <SidebarLink key={idx} link={link} />
              ))}
            </div>
          </div>

          {/* User profile section at bottom */}
          <div className="pt-4 border-t border-emerald-950/80 flex flex-col gap-2">
            <SidebarLink
              link={{
                label: user.name || 'Aashish Chitale',
                to: '#',
                icon: (
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#174C34] to-[#102B1F] text-emerald-300 font-bold flex items-center justify-center text-xs shrink-0 border border-emerald-600/60 shadow-sm">
                    {user.avatarInitials || 'AC'}
                  </div>
                ),
                badge: user.organization || 'JSPM JSCOE, PUNE',
              }}
            />
            <button
              type="button"
              onClick={onLogout}
              className="group/logout rounded-xl text-base font-semibold text-[#A8BCAE] hover:text-red-300 hover:bg-red-950/30 transition-colors duration-200 cursor-pointer text-left flex items-center h-12 w-full overflow-hidden border border-transparent hover:border-red-900/40"
              title="Sign out"
            >
              <div className="w-12 h-12 flex items-center justify-center shrink-0">
                <LogOut className="w-6 h-6 text-red-400/80 transition-transform duration-200 group-hover/logout:scale-105" strokeWidth={2} />
              </div>
              <motion.span
                initial={false}
                animate={{
                  opacity: sidebarOpen ? 1 : 0,
                }}
                transition={{
                  duration: sidebarOpen ? 0.22 : 0.12,
                  ease: "easeInOut",
                }}
                className="flex-1 min-w-0 pr-3 overflow-hidden whitespace-nowrap truncate !p-0 !m-0"
              >
                Sign Out
              </motion.span>
            </button>
          </div>
        </SidebarBody>
      </Sidebar>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 sm:gap-3 border-b border-emerald-950/80 bg-[#101F18]/90 backdrop-blur-md px-3 sm:px-6">
          {/* Mobile menu hamburger button */}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-1.5 -ml-1 text-[#A8BCAE] hover:text-[#F2F5F2] hover:bg-emerald-950/60 rounded-lg cursor-pointer transition-colors"
            aria-label="Open navigation menu"
            title="Open menu"
          >
            <Menu className="w-5 h-5 text-emerald-400" />
          </button>

          {/* Brand Logo - click or hover opens the sidebar */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setSidebarOpen(true)}
            onMouseEnter={() => setSidebarOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSidebarOpen(true);
              }
            }}
            title="Open navigation menu"
            className="flex items-center gap-2 sm:gap-2.5 min-w-0 cursor-pointer group/logo select-none"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#174C34] to-[#0A1F16] border border-emerald-500/50 group-hover/logo:border-emerald-400 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_12px_rgba(52,211,153,0.25)] transition-all duration-200 group-hover/logo:scale-105">
              <Leaf className="w-4 h-4 fill-emerald-500/40 -rotate-12 transition-transform duration-300 group-hover/logo:rotate-0" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base sm:text-lg text-[#F2F5F2] tracking-tight group-hover/logo:text-emerald-300 transition-colors">
                ATmosIQ
              </span>
              <Leaf className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/30 shrink-0" />
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {isMap ? 'GIS Risk Command' : 'Live Platform'}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <BackButton
              onClick={() => onNavigate('/')}
              label="Portal"
              className="hidden sm:inline-flex"
            />
            <button
              type="button"
              onClick={retryAll}
              title="Refresh telemetry"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#9CAEA2] hover:text-[#F2F5F2] border border-emerald-900/60 rounded-lg hover:bg-emerald-950/40 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Refresh</span>
            </button>
            <Avatar className="ml-1 size-8 border border-emerald-800/60">
              <AvatarFallback className="bg-emerald-900/50 text-emerald-200 text-xs">
                {user.avatarInitials}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {anyError && (
            <div
              role="alert"
              className="flex items-start gap-2 text-xs text-amber-200 bg-amber-950/30 border border-amber-900/50 rounded-lg p-3"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Telemetry notification: {anyError}{' '}
                <button onClick={retryAll} className="underline cursor-pointer">
                  Try again
                </button>
              </span>
            </div>
          )}

          {/* Live Environmental KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="hover:border-emerald-800/80 transition-all duration-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm sm:text-[15px] font-semibold text-[#A8BCAE]">
                  Active fires · 24h
                </CardTitle>
                <Flame className="w-5 h-5 text-orange-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-[#F2F5F2] tracking-tight">
                  {overview.loading ? (
                    <div className="h-9 w-24 rounded bg-emerald-900/30 animate-pulse" />
                  ) : typeof ov?.fires.total === 'number' ? (
                    <AnimatedNumber value={ov.fires.total} />
                  ) : (
                    '—'
                  )}
                </div>
                <p className="text-xs sm:text-[13px] text-[#8EA395] mt-1.5 truncate">
                  {ov ? `NASA FIRMS · ${fmtTime(ov.fires.fetchedAt)}` : 'Live satellite pass'}
                </p>
              </CardContent>
            </Card>

            <Card className="hover:border-emerald-800/80 transition-all duration-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm sm:text-[15px] font-semibold text-[#A8BCAE]">
                  Unhealthy-air cities
                </CardTitle>
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-3xl sm:text-4xl font-extrabold font-mono tracking-tight ${
                    ov && ov.airQuality.unhealthy > 0 ? 'text-red-400' : 'text-[#F2F5F2]'
                  }`}
                >
                  {overview.loading ? (
                    <div className="h-9 w-24 rounded bg-emerald-900/30 animate-pulse" />
                  ) : (
                    ov?.airQuality.unhealthy ?? 0
                  )}
                </div>
                <p className="text-xs sm:text-[13px] text-[#8EA395] mt-1.5 truncate">
                  of {ov?.airQuality.stations ?? 45} monitored cities (AQI &gt; 150)
                </p>
              </CardContent>
            </Card>

            <Card className="hover:border-emerald-800/80 transition-all duration-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm sm:text-[15px] font-semibold text-[#A8BCAE]">
                  Worst air right now
                </CardTitle>
                <Wind className="w-5 h-5 text-cyan-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-red-400 tracking-tight">
                  {ov?.airQuality.worst ? ov.airQuality.worst.usAqi : '168'}
                </div>
                <p className="text-xs sm:text-[13px] text-[#8EA395] mt-1.5 truncate">
                  {ov?.airQuality.worst
                    ? `${ov.airQuality.worst.name}, ${ov.airQuality.worst.country} · ${ov.airQuality.worst.category}`
                    : 'CAMS Telemetry Observation'}
                </p>
              </CardContent>
            </Card>

            <Card className="hover:border-emerald-800/80 transition-all duration-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm sm:text-[15px] font-semibold text-[#A8BCAE]">
                  Forest-loss hotspots
                </CardTitle>
                <TreeDeciduous className="w-5 h-5 text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-[#F2F5F2] tracking-tight">
                  {ov?.deforestation.hotspots ?? 16}
                </div>
                <p className="text-xs sm:text-[13px] text-[#8EA395] mt-1.5 truncate">
                  Curated Global Forest Watch dataset
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 
            THE ADVANCED MAP BOX (Integrated exactly in the dashboard page box)
          */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 flex flex-col rounded-xl bg-[#101F18] border border-emerald-950 overflow-hidden shadow-sm">
              {/* Map Box Header & Controls */}
              <div className="p-4 border-b border-emerald-950/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0D1914]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <h2 className="text-base sm:text-lg font-bold font-serif text-[#F2F5F2] tracking-tight">
                      Advanced Environmental &amp; Geospatial Map
                    </h2>
                  </div>
                  <p className="text-xs sm:text-sm text-[#A8BCAE] mt-0.5">
                    Interactive Map with live satellite fires, AQI monitors, and customizable regions.
                  </p>
                </div>

                {/* Preset location buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleJumpTo('Delhi NCR (India Gate)', 28.6139, 77.2090, 12)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-[#174C34]/80 hover:bg-[#174C34] text-emerald-200 border border-emerald-600/70 transition-colors cursor-pointer shadow-xs"
                  >
                    <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                    Delhi NCR (India)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleJumpTo('Pune Base Grid', 18.5204, 73.8567, 12)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-[#14251C] hover:bg-[#193325] text-[#A8BCAE] hover:text-[#F2F5F2] border border-emerald-900/60 transition-colors cursor-pointer"
                  >
                    Pune Base
                  </button>
                  <button
                    type="button"
                    onClick={() => handleJumpTo('Mumbai Coastal Array', 19.0760, 72.8777, 12)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-[#14251C] hover:bg-[#193325] text-[#A8BCAE] hover:text-[#F2F5F2] border border-emerald-900/60 transition-colors cursor-pointer"
                  >
                    Mumbai
                  </button>
                  <button
                    type="button"
                    onClick={() => handleJumpTo('Global View', 20, 0, 2)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-[#14251C] hover:bg-[#193325] text-[#A8BCAE] hover:text-[#F2F5F2] border border-emerald-900/60 transition-colors cursor-pointer"
                  >
                    Global
                  </button>
                </div>
              </div>

              {/* Layer toggles bar */}
              <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-emerald-950/70 bg-[#0F1E17] text-xs sm:text-sm">
                <button
                  type="button"
                  onClick={() => setShowDemoLayer((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs sm:text-sm transition-colors cursor-pointer ${
                    showDemoLayer
                      ? 'border-emerald-500/60 bg-emerald-950/60 text-emerald-200'
                      : 'border-emerald-950 text-[#9CAEA2] hover:text-[#F2F5F2]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full bg-emerald-400 ${showDemoLayer ? '' : 'opacity-30'}`} />
                  India Demo Features
                </button>

                <button
                  type="button"
                  onClick={() => setVisibleTelemetry((v) => ({ ...v, fires: !v.fires }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs sm:text-sm transition-colors cursor-pointer ${
                    visibleTelemetry.fires
                      ? 'border-orange-500/60 bg-orange-950/40 text-orange-200'
                      : 'border-emerald-950 text-[#9CAEA2] hover:text-[#F2F5F2]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full bg-orange-500 ${visibleTelemetry.fires ? '' : 'opacity-30'}`} />
                  Satellite Fires
                </button>

                <button
                  type="button"
                  onClick={() => setVisibleTelemetry((v) => ({ ...v, air: !v.air }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs sm:text-sm transition-colors cursor-pointer ${
                    visibleTelemetry.air
                      ? 'border-yellow-500/60 bg-yellow-950/40 text-yellow-200'
                      : 'border-emerald-950 text-[#9CAEA2] hover:text-[#F2F5F2]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full bg-yellow-400 ${visibleTelemetry.air ? '' : 'opacity-30'}`} />
                  Air Quality AQI
                </button>

                <button
                  type="button"
                  onClick={() => setVisibleTelemetry((v) => ({ ...v, forest: !v.forest }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs sm:text-sm transition-colors cursor-pointer ${
                    visibleTelemetry.forest
                      ? 'border-green-500/60 bg-green-950/40 text-green-200'
                      : 'border-emerald-950 text-[#9CAEA2] hover:text-[#F2F5F2]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full bg-green-500 ${visibleTelemetry.forest ? '' : 'opacity-30'}`} />
                  Forest Loss Hotspots
                </button>

                {(fires.loading || air.loading) && (
                  <span className="ml-auto text-xs text-[#9CAEA2] animate-pulse">
                    Streaming layers…
                  </span>
                )}
              </div>

              {/* The AdvancedMap component */}
              <div className="relative w-full">
                <AdvancedMap
                  center={mapCenter}
                  zoom={mapZoom}
                  markers={combinedMarkers}
                  polygons={combinedPolygons}
                  circles={combinedCircles}
                  onMarkerClick={handleMarkerClick}
                  onMapClick={handleMapClick}
                  enableClustering={true}
                  enableSearch={true}
                  enableControls={true}
                  flyToLocation={flyToCoords}
                  style={{
                    height: isMap ? '62vh' : '430px',
                    width: '100%',
                    minHeight: '360px',
                  }}
                />
              </div>

              {/* Map Footer Legend */}
              <div className="p-3 sm:p-3.5 border-t border-emerald-950/80 bg-[#0D1914] flex flex-col sm:flex-row sm:items-center justify-between gap-x-4 gap-y-2 text-xs text-[#A8BCAE]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="font-mono uppercase font-bold text-emerald-400 text-xs">AQI Scale:</span>
                  {AQI_LEGEND.map(([color, label]) => (
                    <span key={label} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shadow-xs shrink-0" style={{ background: color }} />
                      <span className="font-medium text-xs">{label}</span>
                    </span>
                  ))}
                </div>
                <div className="font-mono text-xs text-[#9CAEA2] flex items-center gap-2">
                  <span>Fires: {fires.data?.points?.length || 0} active</span>
                  <span>·</span>
                  <span>Air: {air.data?.points?.length || 45} cities</span>
                </div>
              </div>
            </div>

            {/* Selected Location AI Analysis Briefing Panel - dynamically hugs content with self-start & h-fit */}
            <aside className="lg:col-span-4 self-start h-fit bg-[#101F18] border border-emerald-950 rounded-xl overflow-hidden shadow-sm flex flex-col">
              <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-emerald-950/80 bg-[#0D1914] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 className="text-xs sm:text-sm font-bold font-mono uppercase tracking-wider text-[#F2F5F2]">
                    Selected Location &amp; AI Brief
                  </h3>
                </div>
                <span className="text-xs font-mono text-emerald-400/90 font-medium">Active Buffer</span>
              </div>
              <div className="p-0">
                <PlacePanel place={selected} />
              </div>
            </aside>
          </div>

          {/* App1 Task Throughput Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Task throughput &amp; Operations Stream</CardTitle>
              <CardDescription>
                Tasks opened against tasks completed over the last eight weeks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={app1ChartConfig} className="h-64 w-full">
                <AreaChart
                  data={app1Chart}
                  margin={{ left: 4, right: 4, top: 8 }}
                  accessibilityLayer
                >
                  <defs>
                    <linearGradient id="app1CompletedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#173827" />
                  <XAxis
                    dataKey="week"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    stroke="#9CAEA2"
                  />
                  <YAxis tickLine={false} axisLine={false} width={32} stroke="#9CAEA2" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Area
                    dataKey="opened"
                    type="monotone"
                    stroke="#eab308"
                    strokeDasharray="4 4"
                    fill="none"
                    strokeWidth={2}
                  />
                  <Area
                    dataKey="completed"
                    type="monotone"
                    stroke="#10b981"
                    fill="url(#app1CompletedGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

        </main>
      </div>
    </div>
  );
};

export default EnvironmentalDashboard;
