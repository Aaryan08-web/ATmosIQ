import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, User as UserIcon, Building2, ArrowRight, AlertCircle, Leaf } from 'lucide-react';
import { AuthService } from '../../services/auth';
import { User } from '../../types';
import { BackButton } from '../ui/back-button';

interface SignupFormProps {
  onSuccess: (user: User) => void;
  onNavigateToLogin: () => void;
  onNavigateToLanding: () => void;
}

export const SignupForm: React.FC<SignupFormProps> = ({
  onSuccess,
  onNavigateToLogin,
  onNavigateToLanding
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute password strength
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: 'Empty', color: 'bg-slate-700' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 1) return { score: 25, label: 'Weak', color: 'bg-red-500' };
    if (score === 2) return { score: 50, label: 'Fair', color: 'bg-amber-500' };
    if (score === 3) return { score: 75, label: 'Good', color: 'bg-emerald-400' };
    return { score: 100, label: 'Strong', color: 'bg-[#2E8B57]' };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Please provide your full legal or institutional name.');
      return;
    }

    if (!email.trim()) {
      setErrorMessage('Please provide your email address.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('The passwords you entered do not match. Please verify both fields.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await AuthService.signup({
        name,
        email,
        organization,
        password,
        confirmPassword
      });

      if (response.success && response.user) {
        onSuccess(response.user);
      } else {
        setErrorMessage(response.error || 'Account creation could not be completed.');
      }
    } catch {
      setErrorMessage('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-[#14251C]/95 backdrop-blur-xl border border-emerald-800/40 rounded-2xl p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.65)] ring-1 ring-emerald-500/10">
      {/* Top Header with ATmosIQ Branding and Animated BackButton */}
      <div className="flex items-center justify-between gap-3 mb-5 pb-3.5 border-b border-emerald-950/80">
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
      <div className="mb-5">
        <div className="inline-block px-2.5 py-0.5 rounded text-[10px] font-mono tracking-wider text-emerald-400 bg-[#174C34]/40 border border-emerald-800/40 mb-1.5">
          REGISTRATION PROTOCOL
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F2F5F2]">
          Create Your Account
        </h1>
        <p className="mt-1 text-xs text-[#9CAEA2] leading-relaxed">
          Join the ATmosIQ planetary risk intelligence network and access high-cadence environmental observation data.
        </p>
      </div>

      {/* Error message banner */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800/50 flex items-start gap-2.5 text-xs text-red-200"
        >
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Name and Email in 2 columns on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Full Name */}
          <div>
            <label
              htmlFor="signup-name"
              className="block text-xs font-medium text-[#F2F5F2] mb-1"
            >
              Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CAEA2]">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                id="signup-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Elena Vance"
                autoComplete="name"
                required
                className="w-full pl-9 pr-3 py-2 bg-[#0B1713]/90 border border-emerald-950 hover:border-emerald-800 focus:border-[#00D6A0] rounded-lg text-xs text-[#F2F5F2] placeholder-[#9CAEA2]/40 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="signup-email"
              className="block text-xs font-medium text-[#F2F5F2] mb-1"
            >
              Institutional or User Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CAEA2]">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vance@biosphere.org"
                autoComplete="email"
                required
                className="w-full pl-9 pr-3 py-2 bg-[#0B1713]/90 border border-emerald-950 hover:border-emerald-800 focus:border-[#00D6A0] rounded-lg text-xs text-[#F2F5F2] placeholder-[#9CAEA2]/40 outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Organization Field (optional) */}
        <div>
          <label
            htmlFor="signup-org"
            className="block text-xs font-medium text-[#F2F5F2] mb-1"
          >
            Organization / Institution <span className="text-[#9CAEA2] text-[10px] font-normal">(optional)</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CAEA2]">
              <Building2 className="w-4 h-4" />
            </div>
            <input
              id="signup-org"
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="e.g. UN Global Environment / Copernicus Alliance"
              className="w-full pl-9 pr-3 py-2 bg-[#0B1713]/90 border border-emerald-950 hover:border-emerald-800 focus:border-[#00D6A0] rounded-lg text-xs text-[#F2F5F2] placeholder-[#9CAEA2]/40 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Password and Confirm Password in 2 columns on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Password Field */}
          <div>
            <label
              htmlFor="signup-password"
              className="block text-xs font-medium text-[#F2F5F2] mb-1"
            >
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CAEA2]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 chars"
                autoComplete="new-password"
                required
                className="w-full pl-9 pr-9 py-2 bg-[#0B1713]/90 border border-emerald-950 hover:border-emerald-800 focus:border-[#00D6A0] rounded-lg text-xs text-[#F2F5F2] placeholder-[#9CAEA2]/40 outline-none transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#9CAEA2] hover:text-[#F2F5F2] transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password Field */}
          <div>
            <label
              htmlFor="signup-confirm-password"
              className="block text-xs font-medium text-[#F2F5F2] mb-1"
            >
              Confirm Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CAEA2]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="signup-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                autoComplete="new-password"
                required
                className="w-full pl-9 pr-9 py-2 bg-[#0B1713]/90 border border-emerald-950 hover:border-emerald-800 focus:border-[#00D6A0] rounded-lg text-xs text-[#F2F5F2] placeholder-[#9CAEA2]/40 outline-none transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#9CAEA2] hover:text-[#F2F5F2] transition-colors cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Compact Password Strength Meter */}
        {password && (
          <div className="pt-0.5">
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-[#9CAEA2]">Strength</span>
              <span className="font-semibold text-emerald-400 font-mono">{strength.label}</span>
            </div>
            <div className="h-1 w-full bg-[#0B1713] rounded-full overflow-hidden flex">
              <div
                className={`h-full ${strength.color} transition-all duration-300`}
                style={{ width: `${strength.score}%` }}
              />
            </div>
          </div>
        )}

        {/* Submit button */}
        <div className="pt-3">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-[#174C34] hover:bg-[#2E8B57] active:bg-[#133E2B] disabled:opacity-50 text-[#F2F5F2] font-semibold text-xs sm:text-sm rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md border border-[#2E8B57]"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Provisioning Node Access...</span>
              </>
            ) : (
              <>
                <span>Create ATmosIQ Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Navigation link to Login */}
      <div className="mt-5 text-center text-xs text-[#9CAEA2] pt-3.5 border-t border-emerald-950/70">
        <span>Already have an ATmosIQ account? </span>
        <button
          type="button"
          onClick={onNavigateToLogin}
          className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-4 transition-colors cursor-pointer ml-1"
        >
          Sign In
        </button>
      </div>
    </div>
  );
};
