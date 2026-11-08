import React from 'react';
import { AuthGlobeBackground } from '../ui/AuthGlobeBackground';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { User } from '../../types';

interface AuthPageProps {
  mode: 'login' | 'signup';
  onAuthSuccess: (user: User) => void;
  onNavigate: (route: string) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  mode,
  onAuthSuccess,
  onNavigate
}) => {
  return (
    <div className="relative min-h-screen w-full bg-[#0B1713] text-[#F2F5F2] flex flex-col justify-between overflow-x-hidden">
      {/* Globe as background visual with interactive observation pins */}
      <AuthGlobeBackground />

      {/* Main Container: Centered readable foreground panel */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 sm:px-6 my-auto">
        {mode === 'login' ? (
          <LoginForm
            onSuccess={onAuthSuccess}
            onNavigateToSignup={() => onNavigate('/signup')}
            onNavigateToLanding={() => onNavigate('/')}
          />
        ) : (
          <SignupForm
            onSuccess={onAuthSuccess}
            onNavigateToLogin={() => onNavigate('/login')}
            onNavigateToLanding={() => onNavigate('/')}
          />
        )}
      </main>
    </div>
  );
};

export default AuthPage;
