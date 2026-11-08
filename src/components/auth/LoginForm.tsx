import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, Mail, ArrowRight, AlertCircle, Leaf } from 'lucide-react';
import { AuthService } from '../../services/auth';
import { User } from '../../types';
import { BackButton } from '../ui/back-button';

interface LoginFormProps {
  onSuccess: (user: User) => void;
  onNavigateToSignup: () => void;
  onNavigateToLanding: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onNavigateToSignup,
  onNavigateToLanding
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Password reset by email is not available yet, so this dialog only explains the options.
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  useEffect(() => {
    if (!isForgotModalOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsForgotModalOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isForgotModalOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email) {
      setErrorMessage('Please enter your institutional email address.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your security access password.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await AuthService.login({
        email,
        password,
        rememberMe
      });

      if (response.success && response.user) {
        onSuccess(response.user);
      } else {
        setErrorMessage(response.error || 'Authentication rejected. Verify credentials.');
      }
    } catch {
      setErrorMessage('Secure connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-[#14251C]/95 backdrop-blur-xl border border-emerald-800/40 rounded-2xl p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.65)] ring-1 ring-emerald-500/10">
      {/* Top Header with ATmosIQ Branding and Animated BackButton */}
      <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-emerald-950/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#174C34] via-[#103323] to-[#0A1F16] border border-emerald-500/60 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.25)]">
            <Leaf className="w-5 h-5 text-emerald-400 fill-emerald-500/40 -rotate-12" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-extrabold tracking-tight text-[#F2F5F2] block leading-none">
                ATmosIQ
              </span>
              <Leaf className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/40" />
            </div>
            <span className="text-[9px] font-mono tracking-widest text-emerald-400 uppercase font-semibold block mt-1">
              ENVIRONMENTAL INTELLIGENCE
            </span>
          </div>
        </div>

        <BackButton onClick={onNavigateToLanding} />
      </div>

      {/* Heading */}
      <div className="mb-6">
        <div className="inline-block px-2.5 py-0.5 rounded text-[10px] font-mono tracking-wider text-emerald-400 bg-[#174C34]/40 border border-emerald-800/40 mb-2">
          AUTH PROTOCOL · SECURE
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F2F5F2]">
          Welcome Back
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-[#9CAEA2] leading-relaxed">
          Sign in to access your environmental risk telemetry, GIS observation feeds, and planetary monitoring tools.
        </p>
      </div>

      {/* Error message banner */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-5 p-3 rounded-lg bg-red-950/40 border border-red-800/50 flex items-start gap-2.5 text-xs text-red-200"
        >
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <div>
          <label
            htmlFor="login-email"
            className="block text-xs font-medium text-[#F2F5F2] mb-1.5"
          >
            Institutional or User Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CAEA2]">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. scientist@atmq.earth"
              autoComplete="email"
              required
              className="w-full pl-9 pr-3 py-2.5 bg-[#0B1713]/90 border border-emerald-950 hover:border-emerald-800 focus:border-[#00D6A0] rounded-lg text-sm text-[#F2F5F2] placeholder-[#9CAEA2]/40 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="login-password"
              className="block text-xs font-medium text-[#F2F5F2]"
            >
              Password
            </label>
            <button
              type="button"
              onClick={() => setIsForgotModalOpen(true)}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CAEA2]">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="current-password"
              required
              className="w-full pl-9 pr-10 py-2.5 bg-[#0B1713]/90 border border-emerald-950 hover:border-emerald-800 focus:border-[#00D6A0] rounded-lg text-sm text-[#F2F5F2] placeholder-[#9CAEA2]/40 outline-none transition-colors font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#9CAEA2] hover:text-[#F2F5F2] transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Remember me checkbox */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-emerald-900 bg-[#0B1713] text-emerald-500 focus:ring-emerald-400 focus:ring-offset-0 accent-[#2E8B57]"
            />
            <span className="text-xs text-[#9CAEA2]">Remember session on this device</span>
          </label>
        </div>

        {/* Submit button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-[#174C34] hover:bg-[#2E8B57] active:bg-[#133E2B] disabled:opacity-50 text-[#F2F5F2] font-semibold text-sm rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md border border-[#2E8B57]"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Signing in…</span>
              </>
            ) : (
              <>
                <span>Sign In to ATmosIQ</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Navigation link to Signup */}
      <div className="mt-6 text-center text-xs text-[#9CAEA2] pt-4 border-t border-emerald-950/70">
        <span>Need an environmental intelligence account? </span>
        <button
          type="button"
          onClick={onNavigateToSignup}
          className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-4 transition-colors cursor-pointer ml-1"
        >
          Create Your Account
        </button>
      </div>

      {/* Forgot Password dialog (informational: email reset is not enabled yet) */}
      {isForgotModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
          onClick={(e) => e.target === e.currentTarget && setIsForgotModalOpen(false)}
        >
          <div className="bg-[#14251C] border border-emerald-800/80 rounded-xl max-w-sm w-full p-6 text-left shadow-2xl">
            <h3 id="forgot-title" className="text-lg font-bold text-[#F2F5F2]">Forgot your password?</h3>
            <p className="mt-2 text-xs text-[#9CAEA2] leading-relaxed">
              Password reset by email is not available yet. Please contact your ATmosIQ administrator and ask them
              to help you regain access, or create a new account with a different email address.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                autoFocus
                onClick={() => setIsForgotModalOpen(false)}
                className="px-4 py-1.5 bg-[#174C34] hover:bg-[#2E8B57] text-[#F2F5F2] text-xs font-medium rounded-lg transition-colors cursor-pointer border border-[#2E8B57]"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
