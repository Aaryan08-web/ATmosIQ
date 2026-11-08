import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/AuthContext';
import { api, ApiError } from '@/lib/api';
import {
  ShieldAlert,
  Users,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Activity,
  Layers,
  Lock,
} from 'lucide-react';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  organization?: string;
  role: 'admin' | 'analyst' | 'researcher' | 'observer';
  createdAt: string;
}

interface AdminStats {
  users: number;
  alerts: number;
  snapshots: number;
  gfwAlerts: number;
  gfwSync: {
    status: string;
    last_attempt_at: string;
    last_success_at: string | null;
    records_ingested: number;
    error_message: string | null;
  };
  timestamp: string;
}

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [uRes, sRes] = await Promise.all([
        api<{ users: AdminUser[] }>('/admin/users'),
        api<AdminStats>('/admin/stats'),
      ]);
      setUsers(uRes.users || []);
      setStats(sRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to retrieve administrative telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchData();
    }
  }, [user]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api(`/admin/users/${userId}/role`, {
        method: 'POST',
        json: { role: newRole },
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole as AdminUser['role'] } : u))
      );
      setSuccessMsg(`Role updated to ${newRole}.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update user role.');
    }
  };

  const handleTriggerSync = async () => {
    setSyncing(true);
    try {
      await api('/gfw/sync', { method: 'POST' });
      await fetchData();
      setSuccessMsg('Global Forest Watch Indian AOI synchronization completed.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Synchronization trigger failed.');
    } finally {
      setSyncing(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="p-8 rounded-2xl bg-[#101F18] border border-red-950/80 text-center max-w-xl mx-auto my-12 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-red-950/60 text-red-400 flex items-center justify-center mx-auto border border-red-800/40">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-[#F2F5F2]">Administrative Access Restricted</h2>
        <p className="text-[#CBDAD0] text-sm leading-relaxed">
          Your current account role is <span className="font-mono text-emerald-400 font-semibold">{user?.role || 'observer'}</span>. Access to the ATmosIQ Administration Console requires the elevated <span className="font-mono text-emerald-400 font-semibold">admin</span> role.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. Header Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <h2 className="text-[22px] sm:text-[26px] font-bold text-[#F2F5F2] tracking-tight">
              Platform Administration &amp; Governance
            </h2>
          </div>
          <p className="text-[14px] sm:text-[15px] text-[#9CAEA2] mt-1">
            System security, user role delegation, and background environmental telemetry orchestration.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#14251C] hover:bg-[#174C34] text-[14px] font-medium text-emerald-300 border border-emerald-800/60 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/80 border border-red-700/60 text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. System KPI Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#A8BCAE]">
            <span className="text-[15px] font-semibold">Registered Analysts</span>
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-[36px] font-bold text-[#F2F5F2] my-1 leading-none">{stats?.users ?? '—'}</div>
          <p className="text-[13px] text-[#9CAEA2]">Active platform accounts</p>
        </div>

        <div className="p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#A8BCAE]">
            <span className="text-[15px] font-semibold">Indian Alerts Active</span>
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-[36px] font-bold text-amber-400 my-1 leading-none">{stats?.alerts ?? '—'}</div>
          <p className="text-[13px] text-[#9CAEA2]">In-boundary environmental triggers</p>
        </div>

        <div className="p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#A8BCAE]">
            <span className="text-[15px] font-semibold">Historical Snapshots</span>
            <Activity className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="text-[36px] font-bold text-cyan-400 my-1 leading-none">{stats?.snapshots ?? '—'}</div>
          <p className="text-[13px] text-[#9CAEA2]">Periodic trend aggregations</p>
        </div>

        <div className="p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#A8BCAE]">
            <span className="text-[15px] font-semibold">GFW Ingestion Status</span>
            <Database className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-[20px] font-bold font-mono text-purple-300 my-1 uppercase">
            {stats?.gfwSync?.status ?? 'Standby'}
          </div>
          <p className="text-[13px] text-[#9CAEA2]">
            {stats?.gfwSync?.last_success_at
              ? `Last: ${new Date(stats.gfwSync.last_success_at).toLocaleTimeString()}`
              : 'Idle'}
          </p>
        </div>
      </div>

      {/* 3. Ingestion Worker Actions */}
      <div className="p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-[18px] font-bold text-[#F2F5F2]">Global Forest Watch Ingestion Pipeline</h3>
            <p className="text-[13px] text-[#9CAEA2] mt-0.5">
              Targeting verified Indian Forest Areas of Interest (Western Ghats, Sundarbans, Assam Hills, Satpura-Maikal).
            </p>
          </div>
          <button
            type="button"
            onClick={handleTriggerSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#174C34] hover:bg-[#1F6244] text-[14px] font-bold text-[#F2F5F2] border border-emerald-600/70 transition-colors disabled:opacity-50 cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Synchronizing AOIs...' : 'Trigger Immediate GFW Sync'}</span>
          </button>
        </div>
      </div>

      {/* 4. Registered Users Management Table */}
      <div className="rounded-xl bg-[#101F18] border border-emerald-950 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-emerald-950/80 bg-[#0D1914] flex items-center justify-between">
          <h3 className="text-[20px] font-bold text-[#F2F5F2]">Registered Platform Accounts</h3>
          <span className="text-[13px] font-mono text-emerald-400 font-semibold">{users.length} Users</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-[#0A1712] border-b border-emerald-950 text-[#A8BCAE] uppercase tracking-wider text-[12px]">
              <tr>
                <th className="py-3 px-5">Name &amp; Email</th>
                <th className="py-3 px-5">Organization</th>
                <th className="py-3 px-5">Role Permission</th>
                <th className="py-3 px-5">Registered At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-950/60">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#14251C]/40 transition-colors">
                  <td className="py-3.5 px-5">
                    <div className="font-bold text-[#F2F5F2]">{u.name}</div>
                    <div className="text-[12px] font-mono text-[#9CAEA2]">{u.email}</div>
                  </td>
                  <td className="py-3.5 px-5 text-[#CBDAD0]">{u.organization || 'Independent Analyst'}</td>
                  <td className="py-3.5 px-5">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="px-2.5 py-1 rounded bg-[#0D1914] border border-emerald-900/60 text-xs font-mono text-[#F2F5F2] focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="admin">admin (Full Control)</option>
                      <option value="analyst">analyst (Standard)</option>
                      <option value="researcher">researcher (Read/Export)</option>
                      <option value="observer">observer (View Only)</option>
                    </select>
                  </td>
                  <td className="py-3.5 px-5 text-[13px] text-[#9CAEA2]">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;

