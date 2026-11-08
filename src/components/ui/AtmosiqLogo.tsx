import React from 'react';
import { Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AtmosiqLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSubtext?: boolean;
  subtext?: string;
  leafOnly?: boolean;
}

export const AtmosiqLogo: React.FC<AtmosiqLogoProps> = ({
  className,
  size = 'md',
  showSubtext = true,
  subtext = 'ENVIRONMENTAL INTELLIGENCE',
  leafOnly = false,
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  };

  const leafSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const titleSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  const subtextSizes = {
    sm: 'text-[8px]',
    md: 'text-[9.5px]',
    lg: 'text-[11px]',
  };

  return (
    <div className={cn('flex items-center gap-2.5 select-none', className)}>
      {/* Leaf Emblem Badge */}
      <div
        className={cn(
          'rounded-xl bg-gradient-to-br from-[#174C34] via-[#103323] to-[#0A1F16] border border-emerald-500/60 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_15px_rgba(52,211,153,0.25)] relative overflow-hidden group',
          iconSizes[size]
        )}
      >
        <div className="absolute inset-0 bg-emerald-400/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
        <Leaf
          className={cn(
            'text-emerald-400 fill-emerald-500/40 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] transform -rotate-12 transition-transform duration-300 group-hover:rotate-0',
            leafSizes[size]
          )}
        />
      </div>

      {!leafOnly && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'font-extrabold tracking-tight text-[#F2F5F2]',
                titleSizes[size]
              )}
            >
              ATmosIQ
            </span>
            <Leaf className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/40 -mt-0.5" />
          </div>
          {showSubtext && (
            <span
              className={cn(
                'font-mono tracking-[0.2em] text-[#9CAEA2] uppercase font-semibold mt-1',
                subtextSizes[size]
              )}
            >
              {subtext}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default AtmosiqLogo;

