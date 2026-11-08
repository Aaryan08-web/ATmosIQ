import { useLocation, useNavigate } from 'react-router-dom';
import { AuthPage } from '@/components/auth/AuthPage';
import { useAuth } from '@/app/AuthContext';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import type { User } from '@/types';

export default function AuthRoute({ mode }: { mode: 'login' | 'signup' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  useDocumentTitle(mode === 'login' ? 'Sign in' : 'Create account');

  const from = (location.state as { from?: string } | null)?.from;

  const handleSuccess = (user: User) => {
    setUser(user);
    navigate(from && from.startsWith('/') ? from : '/dashboard', { replace: true });
  };

  return <AuthPage mode={mode} onAuthSuccess={handleSuccess} onNavigate={(p) => navigate(p)} />;
}
