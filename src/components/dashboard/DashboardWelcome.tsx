import React from 'react';
import { Satellite, Radio } from 'lucide-react';

interface WelcomeProps {
  firesLive?: boolean;
  aqAvailable?: boolean;
  lastUpdated?: string | null;
}

export const DashboardWelcome: React.FC<WelcomeProps> = ({
  firesLive = false,
  aqAvailable = true,
  lastUpdated,
}) => {
  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Live telemetry';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-6 rounded-xl bg-[#101F18] border border-emerald-950/90 shadow-sm">
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-emerald-400">
            CONTINUOUS OBSERVATION ACTIVE · {formattedTime}
          </span>
        </div>

        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold font-serif text-[#F2F5F2] tracking-tight leading-tight">
          India Environmental Intelligence Overview
        </h2>

        <p className="text-[13px] sm:text-[14px] text-[#9CAEA2] max-w-3xl leading-relaxed">
          Monitor environmental conditions, identify vulnerable biomes, and track atmospheric pollution
          and thermal fire anomalies across all 28 Indian States and 8 Union Territories.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 sm:self-center shrink-0">
        {/* Sensor statuses */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0D1914] border border-emerald-950 text-xs text-[#9CAEA2]">
          <Satellite className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>FIRMS:</span>
          <span className={firesLive ? 'text-emerald-300 font-semibold' : 'text-amber-300 font-medium'}>
            {firesLive ? 'Live VIIRS (India)' : 'Sample Telemetry'}
          </span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0D1914] border border-emerald-950 text-xs text-[#9CAEA2]">
          <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>CAMS:</span>
          <span className={aqAvailable ? 'text-emerald-300 font-semibold' : 'text-red-400 font-medium'}>
            {aqAvailable ? '58 Indian Observatories' : 'Unavailable'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DashboardWelcome;
