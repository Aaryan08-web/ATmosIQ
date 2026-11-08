import React, { useState } from 'react';
import { Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '@/app/AuthContext';
import { useApi } from '@/lib/useApi';
import type { Overview, FireResult, AqResult, DeforestationResult, SelectedPlace, User } from '@/types';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';

export interface DashboardContextValue {
  user: User;
  overview: ReturnType<typeof useApi<Overview>>;
  fires: ReturnType<typeof useApi<FireResult>>;
  air: ReturnType<typeof useApi<AqResult>>;
  forest: ReturnType<typeof useApi<DeforestationResult>>;
  refreshAll: () => Promise<void>;
  selectedPlace: SelectedPlace | null;
  setSelectedPlace: React.Dispatch<React.SetStateAction<SelectedPlace | null>>;
  activeAlertCount: number;
}

export function useDashboardContext() {
  return useOutletContext<DashboardContextValue>();
}

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Sidebar collapse state (defaults to true so hover expansion behaves smoothly from compact mode)
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('atmq_sidebar_collapsed');
    return saved !== null ? saved === 'true' : true;
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  // Selected place for map inspection & AI briefing across all views
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>({
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

  // System-wide single-source telemetry (no duplicate fetching)
  const overview = useApi<Overview>('/overview');
  const fires = useApi<FireResult>('/fires');
  const air = useApi<AqResult>('/air-quality');
  const forest = useApi<DeforestationResult>('/deforestation');

  const refreshAll = async () => {
    overview.retry();
    fires.retry();
    air.retry();
    forest.retry();
  };

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('atmq_sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (!user) return null;

  // Calculate real active alerts: Unhealthy AQI cities + severe forest hotspots + high-FRP fires
  const activeAlertCount =
    (overview.data?.airQuality?.unhealthy || 0) +
    (forest.data?.points.filter((p) => p.severity === 'Critical').length || 0) +
    (fires.data?.points.filter((p) => p.frp > 80).length || 0);

  const contextValue: DashboardContextValue = {
    user,
    overview,
    fires,
    air,
    forest,
    refreshAll,
    selectedPlace,
    setSelectedPlace,
    activeAlertCount,
  };

  return (
    <div className="min-h-screen bg-[#0B1713] text-[#F2F5F2] flex flex-row selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Collapsible Persistent Sidebar with Smooth Drawer */}
      <DashboardSidebar
        user={user}
        onLogout={handleLogout}
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Application Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <DashboardHeader
          user={user}
          onOpenMobileSidebar={() => setMobileOpen(true)}
          activeAlertCount={activeAlertCount}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-8">
          <Outlet context={contextValue} />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
