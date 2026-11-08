import React from 'react';
import { NavLink } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

export interface KpiCardProps {
  title: string;
  value: string | number | null;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: {
    label: string;
    variant: 'emerald' | 'amber' | 'red' | 'blue' | 'gray';
  };
  trend?: {
    label: string;
    positive?: boolean;
    neutral?: boolean;
  };
  details?: {
    label: string;
    value: string | number;
  }[];
  linkTo?: string;
  loading?: boolean;
  provenance?: string;
}

const BADGE_STYLES = {
  emerald: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50',
  amber: 'bg-amber-950/50 text-amber-300 border-amber-800/40',
  red: 'bg-red-950/50 text-red-300 border-red-800/40',
  blue: 'bg-blue-950/50 text-blue-300 border-blue-800/40',
  gray: 'bg-[#101F18] text-[#9CAEA2] border-emerald-950',
};

export const EnvironmentalKpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  trend,
  details,
  linkTo,
  loading = false,
  provenance,
}) => {
  const CardContent = (
    <div className="h-full p-5 rounded-xl bg-[#14251C] border border-emerald-950 hover:border-emerald-700/60 transition-all duration-200 flex flex-col justify-between group shadow-sm">
      <div>
        {/* Header: Title, Icon, Badge */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <h4 className="text-[18px] sm:text-[19px] font-semibold text-[#F2F5F2] tracking-tight">{title}</h4>
            {badge && (
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider border ${
                  BADGE_STYLES[badge.variant]
                }`}
              >
                {badge.label}
              </span>
            )}
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#192D23] flex items-center justify-center text-emerald-400 group-hover:text-emerald-300 border border-emerald-900/50 transition-colors shrink-0">
            <Icon className="w-5 h-5" />
          </div>
        </div>

        {/* Primary Value */}
        <div className="flex items-baseline gap-2 mb-1.5">
          {loading ? (
            <div className="h-10 w-28 rounded bg-emerald-900/25 animate-pulse my-1" />
          ) : (
            <span className="text-[34px] sm:text-[38px] font-bold text-[#F2F5F2] tracking-tight leading-none">
              {value ?? '—'}
            </span>
          )}

          {trend && !loading && (
            <span
              className={`text-[13px] font-medium flex items-center gap-0.5 ${
                trend.neutral
                  ? 'text-[#9CAEA2]'
                  : trend.positive
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }`}
            >
              {trend.label}
            </span>
          )}
        </div>

        {/* Subtitle / Description */}
        <p className="text-[14px] sm:text-[15px] text-[#9CAEA2] line-clamp-1 leading-normal">{subtitle}</p>
      </div>

      {/* Optional details footer */}
      <div className="mt-4 pt-3 border-t border-emerald-950/80">
        {details && details.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 text-[13px]">
            {details.map((d, i) => (
              <div key={i} className="truncate">
                <span className="text-[#9CAEA2] mr-1.5">{d.label}:</span>
                <span className="font-semibold text-[#F2F5F2]">{d.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between text-[13px] text-[#9CAEA2]">
            <span>{provenance || 'Telemetry feed'}</span>
            {linkTo && (
              <span className="text-emerald-400 font-medium flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                Explore <ArrowUpRight className="w-4 h-4" />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (linkTo) {
    return (
      <NavLink to={linkTo} className="block h-full focus:outline-none">
        {CardContent}
      </NavLink>
    );
  }

  return CardContent;
};

export default EnvironmentalKpiCard;
