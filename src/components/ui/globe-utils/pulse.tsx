import { cn } from '@/lib/utils';
import React from 'react';

export function Pulse({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative flex size-2.5 [&>*:first-child]:bg-emerald-400/50 [&>*:last-child]:bg-emerald-400',
        className,
      )}
      {...props}
    >
      <span className="animate-ping absolute inline-flex size-full rounded-full" />
      <span className="relative inline-flex rounded-full size-full shadow-[0_0_8px_rgba(0,214,160,0.8)]" />
    </div>
  );
}
