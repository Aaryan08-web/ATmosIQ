import { useNavigate } from 'react-router-dom';
import { EnvironmentalDashboard } from '@/components/dashboard/EnvironmentalDashboard';
import { useAuth } from '@/app/AuthContext';
import { useDocumentTitle } from '@/app/useDocumentTitle';

export default function DashboardRoute({ view }: { view: 'dashboard' | 'map' }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  useDocumentTitle(view === 'map' ? 'GIS Risk Map' : 'Dashboard');
  if (!user) return null; // ProtectedRoute guarantees a user; this satisfies the type checker.

  return (
    <EnvironmentalDashboard
      user={user}
      activeView={view}
      onNavigate={(p) => navigate(p)}
      onLogout={async () => {
        await logout();
        navigate('/login', { replace: true });
      }}
    />
  );
}
