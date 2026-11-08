import React from 'react';
import { Wind, Flame, TreeDeciduous, ShieldAlert } from 'lucide-react';

export type LayerKey = 'air' | 'fires' | 'forest' | 'riskZones';

interface LayerControlsProps {
  layers: Record<LayerKey, boolean>;
  onToggle: (key: LayerKey) => void;
  counts?: {
    air?: number;
    fires?: number;
    forest?: number;
    riskZones?: number;
  };
  liveStatuses?: {
    fires?: boolean;
    air?: boolean;
  };
}

export const MapLayerControls: React.FC<LayerControlsProps> = ({
  layers,
  onToggle,
  counts,
  liveStatuses,
}) => {
  const LAYER_CONFIG: {
    key: LayerKey;
    label: string;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    color: string;
    count?: number;
    badge?: string;
  }[] = [
    {
      key: 'air',
      label: 'Air Quality',
      icon: Wind,
      color: '#06b6d4',
      count: counts?.air,
      badge: liveStatuses?.air ? 'CAMS' : undefined,
    },
    {
      key: 'fires',
      label: 'Satellite Fires',
      icon: Flame,
      color: '#f97316',
      count: counts?.fires,
      badge: liveStatuses?.fires ? 'Live' : 'Sample',
    },
    {
      key: 'forest',
      label: 'Forest Loss Hotspots',
      icon: TreeDeciduous,
      color: '#a855f7',
      count: counts?.forest,
      badge: 'GFW Ref',
    },
    {
      key: 'riskZones',
      label: 'Risk Buffers',
      icon: ShieldAlert,
      color: '#3b82f6',
      count: counts?.riskZones,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-[#0D1914] border border-emerald-950">
      {LAYER_CONFIG.map(({ key, label, icon: Icon, color, count, badge }) => {
        const active = layers[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              active
                ? 'bg-[#14251C] text-[#F2F5F2] border border-emerald-800/60 shadow-sm'
                : 'text-[#9CAEA2] hover:text-[#F2F5F2] hover:bg-[#101F18] border border-transparent'
            }`}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: active ? color : '#475569' }}
            />
            <Icon
              className="w-3.5 h-3.5 shrink-0"
              style={{ color: active ? color : '#9CAEA2' }}
            />
            <span>{label}</span>

            {count != null && (
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/30 text-[#9CAEA2]">
                {count}
              </span>
            )}

            {badge && (
              <span className="text-[8px] font-mono px-1 py-0.2 rounded uppercase border border-emerald-900/40 text-emerald-400 bg-emerald-950/30">
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default MapLayerControls;
