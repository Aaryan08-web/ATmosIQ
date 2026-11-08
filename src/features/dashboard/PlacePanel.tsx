import { useEffect, useState } from 'react';
import { Sparkles, MapPin, Flame, Wind, TreeDeciduous, Crosshair, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api, ApiError } from '@/lib/api';
import type { AiSummary, SelectedPlace } from '@/types';

const ICON = { fire: Flame, air: Wind, forest: TreeDeciduous, point: Crosshair } as const;

export function PlacePanel({ place }: { place: SelectedPlace | null }) {
  const [summary, setSummary] = useState<AiSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when a new place is picked.
  useEffect(() => {
    setSummary(null);
    setError(null);
    setLoading(false);
  }, [place?.lat, place?.lon]);

  if (!place) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-5 text-[#9CAEA2]">
        <MapPin className="w-6 h-6 text-emerald-500/60 mb-2" />
        <p className="text-sm font-semibold text-[#F2F5F2]">Select a location</p>
        <p className="text-xs mt-1 max-w-[16rem] leading-relaxed">
          Click an observatory, air-quality station, or fire point on the map to generate an AI risk brief.
        </p>
      </div>
    );
  }

  const Icon = ICON[place.kind];

  const analyse = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<AiSummary>('/ai/summary', {
        method: 'POST',
        json: { name: place.name, lat: place.lat, lon: place.lon },
      });
      setSummary(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not generate the brief.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-[#174C34]/60 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-500/40 shadow-sm">
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl sm:text-[22px] font-bold text-[#F2F5F2] leading-snug break-words">
            {place.name}
          </h3>
          <p className="text-[14px] text-emerald-400 font-semibold mt-0.5">
            {place.lat.toFixed(4)}°, {place.lon.toFixed(4)}°
          </p>
        </div>
      </div>

      {place.details.length > 0 && (
        <ul className="space-y-2 text-[15px] sm:text-[16px] leading-relaxed text-[#A8BCAE]">
          {place.details.map((d) => (
            <li key={d} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={analyse}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#174C34] to-[#1F6244] hover:from-[#1F6244] hover:to-[#2E8B57] disabled:opacity-60 disabled:cursor-wait border border-emerald-500/50 hover:border-emerald-400 text-[16px] font-bold text-[#F2F5F2] transition-all duration-200 cursor-pointer shadow-lg shadow-emerald-950/50 hover:shadow-emerald-900/40"
      >
        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-emerald-300" />}
        {loading ? 'Analysing area…' : summary ? 'Regenerate brief' : 'Generate AI risk brief'}
      </button>

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2.5" aria-hidden="true">
            {[100, 92, 96, 70].map((w, i) => (
              <div key={i} className="h-3.5 rounded bg-emerald-900/40 animate-pulse" style={{ width: `${w}%` }} />
            ))}
          </motion.div>
        )}
        {error && !loading && (
          <motion.p key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[15px] text-red-300 bg-red-950/40 border border-red-900/50 rounded-xl p-3.5" role="alert">
            {error}
          </motion.p>
        )}
        {summary && !loading && (
          <motion.div key="sum" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-3.5 pt-1">
            <p className="text-[16px] text-[#F2F5F2] leading-relaxed whitespace-pre-line font-medium">
              {summary.summary}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className={`px-2.5 py-1 rounded-md border font-semibold ${summary.source === 'gemini' ? 'border-emerald-600/50 text-emerald-300 bg-emerald-950/60' : 'border-amber-700/50 text-amber-300 bg-amber-950/50'}`}>
                {summary.source === 'gemini' ? 'AI-generated · Gemini' : 'Rule-based summary (AI offline)'}
              </span>
              <span className="text-[#9CAEA2]">
                {summary.context.fires.count} fires within {summary.context.radiusKm} km · {new Date(summary.generatedAt).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-[13px] text-[#9CAEA2]/80 leading-relaxed">
              Briefs use only the measurements shown on this platform. Verify before acting on them.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
