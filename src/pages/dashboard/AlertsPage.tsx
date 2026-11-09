import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, Filter, Flame, Wind, TreeDeciduous } from 'lucide-react';
import { api } from '@/lib/api';

interface EnvironmentalAlert {
  id: string;
  fingerprint: string;
  type: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  title: string;
  location: string;
  lat: number;
  lon: number;
  source: string;
  details: string;
  acknowledged: number;
  created_at: string;
}

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<EnvironmentalAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unacknowledged' | 'acknowledged'>('all');

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await api<{ alerts: EnvironmentalAlert[]; total: number; unacknowledged: number }>('/alerts');
      setAlerts(res.alerts || []);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleToggleAcknowledge = async (id: string) => {
    try {
      const res = await api<{ ok: boolean; acknowledged: number }>(`/alerts/${id}/acknowledge`, {
        method: 'POST',
      });
      if (res.ok) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === id ? { ...a, acknowledged: res.acknowledged } : a))
        );
      }
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  // Filtered Alerts
  const filteredAlerts = alerts.filter((a) => {
    const matchesSeverity = filterSeverity === 'all' || a.severity === filterSeverity;
    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'acknowledged'
        ? a.acknowledged === 1
        : a.acknowledged === 0;
    return matchesSeverity && matchesStatus;
  });

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const unackCount = alerts.filter((a) => !a.acknowledged).length;

  const getAlertIcon = (type: string) => {
    if (type.includes('air')) return Wind;
    if (type.includes('fire')) return Flame;
    return TreeDeciduous;
  };

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      {/* 1. Header & Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 min-w-0">
        <div className="p-4 sm:p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-1 min-w-0">
          <span className="text-xs text-[#A8BCAE] uppercase font-semibold block">Total Active Triggers</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[#F2F5F2] leading-none my-1">{alerts.length}</div>
          <p className="text-xs text-[#9CAEA2]">Real-time telemetry event records</p>
        </div>

        <div className="p-4 sm:p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-1 min-w-0">
          <span className="text-xs text-red-300 uppercase font-semibold block">Critical Severities</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-red-400 leading-none my-1">{criticalCount}</div>
          <p className="text-xs text-[#9CAEA2]">Requiring immediate surveillance</p>
        </div>

        <div className="p-4 sm:p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-1 min-w-0">
          <span className="text-xs text-amber-300 uppercase font-semibold block">Pending Review</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-amber-400 leading-none my-1">{unackCount}</div>
          <p className="text-xs text-[#9CAEA2]">Awaiting analyst acknowledgement</p>
        </div>
      </div>

      {/* 2. Controls & Filter Bar (No Manual Refresh Button) */}
      <div className="p-4 sm:p-5 rounded-xl bg-[#101F18] border border-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="w-5 h-5 text-emerald-400 shrink-0" />
          <h2 className="text-base sm:text-lg font-bold font-serif text-[#F2F5F2] truncate">
            Environmental Incident Records
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          {/* Status Filter */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0D1914] border border-emerald-950 text-xs sm:text-[13px]">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                filterStatus === 'all' ? 'bg-[#14251C] text-emerald-300 font-semibold' : 'text-[#9CAEA2]'
              }`}
            >
              All ({alerts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('unacknowledged')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                filterStatus === 'unacknowledged' ? 'bg-[#14251C] text-amber-300 font-semibold' : 'text-[#9CAEA2]'
              }`}
            >
              Pending ({unackCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('acknowledged')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                filterStatus === 'acknowledged' ? 'bg-[#14251C] text-emerald-300 font-semibold' : 'text-[#9CAEA2]'
              }`}
            >
              Acknowledged
            </button>
          </div>

          {/* Severity Filter */}
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[#14251C] border border-emerald-900/60 text-xs sm:text-[13px] text-[#F2F5F2] focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="moderate">Moderate</option>
          </select>
        </div>
      </div>

      {/* 3. Real Alert Cards List */}
      <div className="space-y-3 min-w-0">
        {loading && alerts.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9CAEA2] bg-[#101F18] border border-emerald-950 rounded-xl">
            Loading active telemetry alerts…
          </div>
        ) : filteredAlerts.length > 0 ? (
          filteredAlerts.map((a) => {
            const Icon = getAlertIcon(a.type);
            const isCrit = a.severity === 'critical';

            return (
              <div
                key={a.id}
                className={`p-4 sm:p-5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 min-w-0 ${
                  a.acknowledged
                    ? 'bg-[#0D1914]/70 border-emerald-950/60 opacity-75'
                    : isCrit
                    ? 'bg-[#15231C] border-red-900/60 shadow-sm'
                    : 'bg-[#101F18] border-amber-900/50 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 ${
                      isCrit
                        ? 'bg-red-950/60 text-red-400 border-red-800/60'
                        : 'bg-amber-950/60 text-amber-400 border-amber-800/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider border shrink-0 ${
                          isCrit
                            ? 'bg-red-950 text-red-300 border-red-800'
                            : 'bg-amber-950 text-amber-300 border-amber-800'
                        }`}
                      >
                        {a.severity}
                      </span>
                      <h3 className="text-[15px] sm:text-base font-bold font-serif text-[#F2F5F2] truncate">{a.title}</h3>
                      {a.acknowledged ? (
                        <span className="px-2 py-0.5 rounded text-[11px] text-emerald-400 bg-emerald-950/80 border border-emerald-800/50 font-medium">
                          Acknowledged
                        </span>
                      ) : null}
                    </div>

                    <p className="text-xs sm:text-[13px] text-[#A8BCAE] truncate">{a.location} · {a.lat.toFixed(3)}°N, {a.lon.toFixed(3)}°E</p>
                    <p className="text-sm sm:text-[15px] text-[#CBDAD0] leading-relaxed pt-0.5">{a.details}</p>

                    <div className="flex flex-wrap items-center gap-3 text-xs sm:text-[13px] text-[#9CAEA2] pt-1 border-t border-emerald-950/40">
                      <span>Source: <strong className="text-emerald-400 font-medium">{a.source}</strong></span>
                      <span className="font-mono text-xs sm:text-[13px] text-[#82978B]">
                        {new Date(a.created_at).toLocaleDateString()} {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex sm:flex-col items-center justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-emerald-950/80">
                  <button
                    type="button"
                    onClick={() => handleToggleAcknowledge(a.id)}
                    className={`min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-[13px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      a.acknowledged
                        ? 'bg-[#14251C] text-[#9CAEA2] hover:text-[#F2F5F2] border border-emerald-900/60'
                        : 'bg-[#174C34] hover:bg-[#1F6244] text-emerald-200 border border-emerald-600/70 shadow-sm'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{a.acknowledged ? 'Mark Unread' : 'Acknowledge'}</span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 sm:p-12 text-center text-sm text-[#9CAEA2] bg-[#101F18] border border-dashed border-emerald-950 rounded-xl space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-400/60 mx-auto mb-2" />
            <p className="font-semibold text-[#F2F5F2] text-base">No alerts match the selected criteria.</p>
            <p className="text-sm text-[#9CAEA2]">All monitored thresholds are currently within nominal limits.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertsPage;
