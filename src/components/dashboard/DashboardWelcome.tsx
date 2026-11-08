import React from 'react';
import { RefreshCw, Satellite, Radio, ShieldCheck } from 'lucide-react';

interface WelcomeProps {
  firesLive?: boolean;
  aqAvailable?: boolean;
  lastUpdated?: string | null;
  onRefresh?: () => void;
  loading?: boolean;
}

export const DashboardWelcome: React.FC<WelcomeProps> = ({
  firesLive = false,
  aqAvailable = true,
  lastUpdated,
  onRefresh,
  loading = false,
}) => {
  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Live telemetry';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-[#101F18] border border-emerald-950/90 shadow-sm">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[12px] font-semibold uppercase tracking-wider text-emerald-400">
            CONTINUOUS OBSERVATION ACTIVE
          </span>
        </div>

        <h2 className="text-2xl sm:text-[32px] lg:text-[34px] font-bold text-[#F2F5F2] tracking-tight leading-tight">
          Environmental Intelligence Overview
        </h2>

        <p className="text-[16px] sm:text-[17px] text-[#9CAEA2] max-w-3xl leading-relaxed">
          Monitor environmental conditions, identify vulnerable regions, and understand emerging
          environmental threats through geospatial intelligence.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:self-center shrink-0">
        {/* Sensor statuses */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0D1914] border border-emerald-950 text-[13px] text-[#9CAEA2]">
          <Satellite className="w-4 h-4 text-emerald-400" />
          <span>FIRMS:</span>
          <span className={firesLive ? 'text-emerald-300 font-semibold' : 'text-amber-300'}>
            {firesLive ? 'Live VIIRS' : 'Sample Telemetry'}
          </span>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0D1914] border border-emerald-950 text-[13px] text-[#9CAEA2]">
          <Radio className="w-4 h-4 text-emerald-400" />
          <span>CAMS:</span>
          <span className={aqAvailable ? 'text-emerald-300 font-semibold' : 'text-red-400'}>
            {aqAvailable ? '45 Cities Online' : 'Unavailable'}
          </span>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh active telemetry streams"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#14251C] hover:bg-[#174C34] border border-emerald-900/60 hover:border-emerald-500 text-[15px] font-medium text-[#F2F5F2] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default DashboardWelcome;
