import React, { useState, useCallback } from 'react';
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
  selectedRadiusKm: number;
  setSelectedRadiusKm: React.Dispatch<React.SetStateAction<number>>;
  activeAlertCount: number;
}

export function useDashboardContext() {
  return useOutletContext<DashboardContextValue>();
}

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Sidebar open/closed state (closed by default on initial dashboard load; single source of truth)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  // Selected analysis radius buffer in kilometers (defaults to 150 km)
  const [selectedRadiusKm, setSelectedRadiusKm] = useState<number>(150);

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

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  const handleOpenSidebar = useCallback(() => {
    setIsSidebarOpen(true);
  }, []);

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
    selectedRadiusKm,
    setSelectedRadiusKm,
    activeAlertCount,
  };

  return (
    <div className="min-h-screen bg-[#0B1713] text-[#F2F5F2] flex flex-row selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Sidebar with Desktop Push & Mobile Drawer */}
      <DashboardSidebar
        user={user}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
        onToggle={handleToggleSidebar}
      />

      {/* Main Application Area with Sticky Header */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-clip">
        <DashboardHeader
          user={user}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={handleToggleSidebar}
          activeAlertCount={activeAlertCount}
        />

        <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 sm:space-y-8 min-w-0">
          <Outlet context={contextValue} />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
