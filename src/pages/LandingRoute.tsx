import { useNavigate } from 'react-router-dom';
import { LandingPage } from '@/components/landing/LandingPage';
import { useAuth } from '@/app/AuthContext';
import { useDocumentTitle } from '@/app/useDocumentTitle';

export default function LandingRoute() {
  const navigate = useNavigate();
  const { user } = useAuth();
  useDocumentTitle('');
  return <LandingPage onNavigate={(p) => navigate(p)} isAuthenticated={!!user} />;
}
