import { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { GuestRoute, ProtectedRoute } from './guards';
import { NotFoundPage, PageLoader, RouteErrorPage } from './Fallbacks';

import LandingRoute from '@/pages/LandingRoute';
const AuthRoute = lazy(() => import('@/pages/AuthRoute'));

// Dashboard Layout & Modular Page Views
const DashboardLayout = lazy(() => import('@/components/dashboard/DashboardLayout'));
const OverviewPage = lazy(() => import('@/pages/dashboard/OverviewPage'));
const RiskMapPage = lazy(() => import('@/pages/dashboard/RiskMapPage'));
const AtmosphericPage = lazy(() => import('@/pages/dashboard/AtmosphericPage'));
const RiskAnalysisPage = lazy(() => import('@/pages/dashboard/RiskAnalysisPage'));
const AiBriefPage = lazy(() => import('@/pages/dashboard/AiBriefPage'));
const AlertsPage = lazy(() => import('@/pages/dashboard/AlertsPage'));
const DataSourcesPage = lazy(() => import('@/pages/dashboard/DataSourcesPage'));
const SettingsPage = lazy(() => import('@/pages/dashboard/SettingsPage'));

function Root() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/', element: <LandingRoute /> },
      {
        element: <GuestRoute />,
        children: [
          { path: '/login', element: <AuthRoute mode="login" /> },
          { path: '/signup', element: <AuthRoute mode="signup" /> },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: '/dashboard',
            element: <DashboardLayout />,
            children: [
              { index: true, element: <OverviewPage /> },
              { path: 'map', element: <RiskMapPage /> },
              { path: 'atmospheric', element: <AtmosphericPage /> },
              { path: 'risk-analysis', element: <RiskAnalysisPage /> },
              { path: 'ai-brief', element: <AiBriefPage /> },
              { path: 'alerts', element: <AlertsPage /> },
              { path: 'data-sources', element: <DataSourcesPage /> },
              { path: 'settings', element: <SettingsPage /> },
            ],
          },
          { path: '/map', element: <Navigate to="/dashboard/map" replace /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
