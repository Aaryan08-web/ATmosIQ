import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, Filter, RefreshCw, Flame, Wind, TreeDeciduous, Info } from 'lucide-react';
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
    <div className="space-y-8">
      {/* 1. Header & Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-2 flex flex-col justify-between">
          <span className="text-[15px] sm:text-[16px] font-semibold text-[#A8BCAE]">Total Active Triggers</span>
          <div className="text-[36px] sm:text-[40px] font-bold text-[#F2F5F2] leading-none my-1">{alerts.length}</div>
          <p className="text-[14px] text-[#9CAEA2]">Real-time telemetry event records</p>
        </div>

        <div className="p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-2 flex flex-col justify-between">
          <span className="text-[15px] sm:text-[16px] font-semibold text-[#A8BCAE]">Critical Severities</span>
          <div className="text-[36px] sm:text-[40px] font-bold text-red-400 leading-none my-1">{criticalCount}</div>
          <p className="text-[14px] text-[#9CAEA2]">Requiring high surveillance priority</p>
        </div>

        <div className="p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-2 flex flex-col justify-between">
          <span className="text-[15px] sm:text-[16px] font-semibold text-[#A8BCAE]">Pending Acknowledgement</span>
          <div className="text-[36px] sm:text-[40px] font-bold text-amber-400 leading-none my-1">{unackCount}</div>
          <p className="text-[14px] text-[#9CAEA2]">Awaiting analyst sign-off</p>
        </div>
      </div>

      {/* 2. Controls & Filter Bar */}
      <div className="p-5 rounded-xl bg-[#101F18] border border-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-emerald-400" />
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#F2F5F2]">Operational Incident Records</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#0D1914] border border-emerald-950 text-[14px]">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                filterStatus === 'all' ? 'bg-[#14251C] text-emerald-300 font-semibold' : 'text-[#9CAEA2]'
              }`}
            >
              All Status
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
            className="px-3.5 py-2 rounded-lg bg-[#14251C] border border-emerald-900/60 text-[14px] text-[#F2F5F2] cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="moderate">Moderate</option>
          </select>

          <button
            type="button"
            onClick={fetchAlerts}
            className="p-2 rounded-lg bg-[#14251C] hover:bg-[#174C34] text-emerald-300 border border-emerald-800/60 transition-colors cursor-pointer"
            title="Refresh alerts"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 3. Real Alert Cards List */}
      <div className="space-y-3.5">
        {loading && alerts.length === 0 ? (
          <div className="p-12 text-center text-[15px] text-[#9CAEA2] bg-[#101F18] border border-emerald-950 rounded-xl">
            Loading active telemetry alerts…
          </div>
        ) : filteredAlerts.length > 0 ? (
          filteredAlerts.map((a) => {
            const Icon = getAlertIcon(a.type);
            const isCrit = a.severity === 'critical';

            return (
              <div
                key={a.id}
                className={`p-5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  a.acknowledged
                    ? 'bg-[#0D1914]/80 border-emerald-950/60 opacity-75'
                    : isCrit
                    ? 'bg-[#15231C] border-red-900/60 shadow-sm'
                    : 'bg-[#101F18] border-amber-900/50 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                      isCrit
                        ? 'bg-red-950/60 text-red-400 border-red-800/60'
                        : 'bg-amber-950/60 text-amber-400 border-amber-800/60'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider border ${
                          isCrit
                            ? 'bg-red-950 text-red-300 border-red-800'
                            : 'bg-amber-950 text-amber-300 border-amber-800'
                        }`}
                      >
                        {a.severity}
                      </span>
                      <h3 className="text-[17px] sm:text-[18px] font-bold text-[#F2F5F2]">{a.title}</h3>
                      {a.acknowledged ? (
                        <span className="px-2.5 py-0.5 rounded text-[11px] text-emerald-400 bg-emerald-950/80 border border-emerald-800/50 font-medium">
                          Acknowledged
                        </span>
                      ) : null}
                    </div>

                    <p className="text-[14px] text-[#9CAEA2]">{a.location} · {a.lat.toFixed(3)}°, {a.lon.toFixed(3)}°</p>
                    <p className="text-[15px] sm:text-[16px] text-[#CBDAD0] leading-relaxed pt-0.5">{a.details}</p>

                    <div className="flex items-center gap-4 text-[13px] text-[#9CAEA2] pt-1">
                      <span>Source: <strong className="text-emerald-400">{a.source}</strong></span>
                      <span>Triggered: {new Date(a.created_at).toLocaleDateString()} {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex sm:flex-col items-center justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-emerald-950/80">
                  <button
                    type="button"
                    onClick={() => handleToggleAcknowledge(a.id)}
                    className={`px-4 py-2.5 rounded-lg text-[14px] font-semibold transition-colors cursor-pointer flex items-center gap-2 ${
                      a.acknowledged
                        ? 'bg-[#14251C] text-[#9CAEA2] hover:text-[#F2F5F2] border border-emerald-900/60'
                        : 'bg-[#174C34] hover:bg-[#1F6244] text-emerald-200 border border-emerald-600/70 shadow-sm'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{a.acknowledged ? 'Mark Unread' : 'Acknowledge'}</span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-12 text-center text-[15px] text-[#9CAEA2] bg-[#101F18] border border-dashed border-emerald-950 rounded-xl space-y-1">
            <CheckCircle2 className="w-8 h-8 text-emerald-400/60 mx-auto mb-2" />
            <p className="font-semibold text-[#F2F5F2] text-[16px]">No alerts match the selected criteria.</p>
            <p>All monitored thresholds are currently within nominal limits.</p>
          </div>
        )}
      </div>

      {/* Alert Policy & Deduplication Notice */}
      <div className="flex items-start gap-3 p-5 rounded-xl bg-[#0D1914] border border-emerald-950/80 text-[14px] sm:text-[15px] text-[#9CAEA2] leading-relaxed">
        <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-[#F2F5F2]">Alert Integrity Policy: </span>
          Alerts are derived exclusively from verified anomalies (CAMS US AQI &gt; 150, NASA FIRMS FRP &gt; 80 MW, and Critical GFW loss biomes). Fingerprint deduplication guarantees recurring sensor passes do not spam redundant duplicate records.
        </div>
      </div>
    </div>
  );
};

export default AlertsPage;

