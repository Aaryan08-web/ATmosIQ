import React from 'react';

export const MapLegend: React.FC = () => {
  const LEGEND_ITEMS = [
    { color: '#22c55e', label: 'Low Risk' },
    { color: '#eab308', label: 'Moderate Risk' },
    { color: '#f97316', label: 'High Risk / Fire' },
    { color: '#ef4444', label: 'Critical Risk' },
    { color: '#3b82f6', label: 'Selected Location' },
    { color: '#a855f7', label: 'Forest Loss Hotspot' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2 px-3 rounded-lg bg-[#0D1914] border border-emerald-950 text-[11px] font-mono text-[#9CAEA2]">
      <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[10px]">
        LEGEND:
      </span>
      {LEGEND_ITEMS.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-[#F2F5F2]">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

export default MapLegend;
