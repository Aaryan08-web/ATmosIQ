import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/AuthContext';
import { AuthService } from '@/services/auth';
import {
  User as UserIcon,
  Building,
  Key,
  Shield,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Lock,
  Mail,
  Calendar,
  Layers,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();

  // Profile form state
  const [name, setName] = useState(user?.name || '');
  const [organization, setOrganization] = useState(user?.organization || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Sign out state
  const [loggingOut, setLoggingOut] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    if (!name.trim()) {
      setProfileError('Full name cannot be blank.');
      return;
    }

    setProfileLoading(true);
    try {
      const res = await AuthService.updateProfile({
        name: name.trim(),
        organization: organization.trim(),
      });
      if (res.success && res.user) {
        setUser(res.user);
        setProfileSuccess('Profile updated successfully.');
      } else {
        setProfileError(res.error || 'Failed to update profile.');
      }
    } catch {
      setProfileError('Unexpected error updating profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match. Please re-enter to confirm.');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await AuthService.changePassword({
        currentPassword,
        newPassword,
      });
      if (res.success) {
        setPasswordSuccess('Password changed successfully. Your next login will require the new credentials.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(res.error || 'Failed to change password.');
      }
    } catch {
      setPasswordError('Unexpected error changing password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login');
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Heading */}
      <div className="rounded-xl border border-[#1b3d2f] bg-[#0c1b14] p-6 shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 font-bold text-emerald-400 text-2xl shadow-inner">
              {user?.avatarInitials || 'AQ'}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-[24px] sm:text-[28px] font-bold tracking-tight text-[#e1f5ec]">{user?.name || 'Analyst'}</h2>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-[12px] font-semibold uppercase tracking-wider text-emerald-400">
                  {user?.role || 'analyst'}
                </span>
              </div>
              <p className="text-[14px] text-[#82a796] flex items-center gap-3 mt-1 font-medium">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-[#5e8f77]" />
                  {user?.email}
                </span>
                {user?.createdAt && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-[#5e8f77]" />
                    Member since {user.createdAt}
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            disabled={loggingOut}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-[14px] font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50 cursor-pointer"
          >
            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Sign Out
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Profile & Organization Form */}
        <div className="rounded-xl border border-[#1b3d2f] bg-[#0c1b14] p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 border-b border-[#1b3d2f] pb-3.5 mb-4">
              <UserIcon className="h-5 w-5 text-emerald-400" />
              <h3 className="font-bold text-[19px] sm:text-[20px] text-[#e1f5ec]">Account &amp; Organization Profile</h3>
            </div>
            <p className="text-[14px] sm:text-[15px] text-[#82a796] mb-5 leading-normal">
              Update your analyst profile details and enterprise organization affiliation across ATmosIQ reports.
            </p>

            {profileSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-[14px] text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{profileSuccess}</span>
              </div>
            )}
            {profileError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-[14px] text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-[15px] font-medium text-[#a3c9b8] mb-1.5">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-3 h-4 w-4 text-[#5e8f77]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-[#1b3d2f] bg-[#07130e] pl-10 pr-3.5 py-2.5 text-[15px] text-[#e1f5ec] placeholder-[#4f7864] focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Marcus Aurel"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[15px] font-medium text-[#a3c9b8] mb-1.5">Email Address (Immutable)</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-[#5e8f77]" />
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full rounded-lg border border-[#1b3d2f] bg-[#07130e]/50 pl-10 pr-3.5 py-2.5 text-[15px] text-[#6e9684] cursor-not-allowed"
                  />
                </div>
                <span className="text-[13px] text-[#5e8f77] mt-1.5 block">
                  Email changes require administrator approval for auditing compliance.
                </span>
              </div>

              <div>
                <label className="block text-[15px] font-medium text-[#a3c9b8] mb-1.5">Organization / Enterprise</label>
                <div className="relative">
                  <Building className="absolute left-3.5 top-3 h-4 w-4 text-[#5e8f77]" />
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    className="w-full rounded-lg border border-[#1b3d2f] bg-[#07130e] pl-10 pr-3.5 py-2.5 text-[15px] text-[#e1f5ec] placeholder-[#4f7864] focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Climate Risk Operations / Global Forest Watch Lab"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-[15px] font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                >
                  {profileLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Security & Password Change Form */}
        <div className="rounded-xl border border-[#1b3d2f] bg-[#0c1b14] p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 border-b border-[#1b3d2f] pb-3.5 mb-4">
              <Key className="h-5 w-5 text-emerald-400" />
              <h3 className="font-bold text-[19px] sm:text-[20px] text-[#e1f5ec]">Security &amp; Password</h3>
            </div>
            <p className="text-[14px] sm:text-[15px] text-[#82a796] mb-5 leading-normal">
              Manage authentication credentials and encryption protocols protecting your session.
            </p>

            {passwordSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-[14px] text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{passwordSuccess}</span>
              </div>
            )}
            {passwordError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-[14px] text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-[15px] font-medium text-[#a3c9b8] mb-1.5">Current Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-[#5e8f77]" />
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-lg border border-[#1b3d2f] bg-[#07130e] pl-10 pr-3.5 py-2.5 text-[15px] text-[#e1f5ec] placeholder-[#4f7864] focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Enter current password"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[15px] font-medium text-[#a3c9b8] mb-1.5">New Password</label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-3 h-4 w-4 text-[#5e8f77]" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-[#1b3d2f] bg-[#07130e] pl-10 pr-3.5 py-2.5 text-[15px] text-[#e1f5ec] placeholder-[#4f7864] focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[15px] font-medium text-[#a3c9b8] mb-1.5">Confirm New Password</label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-3 h-4 w-4 text-[#5e8f77]" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-[#1b3d2f] bg-[#07130e] pl-10 pr-3.5 py-2.5 text-[15px] text-[#e1f5ec] placeholder-[#4f7864] focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Re-enter new password"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-[15px] font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                >
                  {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Session Security & System Architecture Info */}
      <div className="rounded-xl border border-[#1b3d2f] bg-[#0c1b14] p-6 shadow-lg">
        <div className="flex items-center gap-2.5 border-b border-[#1b3d2f] pb-3.5 mb-4">
          <Shield className="h-5 w-5 text-emerald-400" />
          <h3 className="font-bold text-[19px] sm:text-[20px] text-[#e1f5ec]">Active Session &amp; Security Guarantees</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-[#1b3d2f] bg-[#07130e] p-4">
            <div className="flex items-center gap-2 text-[15px] font-semibold text-[#a3c9b8] mb-1.5">
              <Shield className="h-4 w-4 text-emerald-400" />
              Cookie Protection
            </div>
            <p className="text-[13px] text-[#82a796] leading-normal">
              Encrypted HttpOnly cookie (<code className="text-emerald-300">atmq_session</code>) with SameSite=Lax
              protection against CSRF attacks.
            </p>
          </div>

          <div className="rounded-lg border border-[#1b3d2f] bg-[#07130e] p-4">
            <div className="flex items-center gap-2 text-[15px] font-semibold text-[#a3c9b8] mb-1.5">
              <Layers className="h-4 w-4 text-emerald-400" />
              Role Permissions
            </div>
            <p className="text-[13px] text-[#82a796] leading-normal">
              Authorized as <strong className="text-emerald-300 capitalize">{user?.role || 'analyst'}</strong> with
              access to live telemetry ingestion and AI brief triggers.
            </p>
          </div>

          <div className="rounded-lg border border-[#1b3d2f] bg-[#07130e] p-4">
            <div className="flex items-center gap-2 text-[15px] font-semibold text-[#a3c9b8] mb-1.5">
              <Key className="h-4 w-4 text-emerald-400" />
              Brute Force Defense
            </div>
            <p className="text-[13px] text-[#82a796] leading-normal">
              5-attempt progressive lockout algorithm active on authentication endpoints with bcrypt work-factor 12.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

