import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useDashboardContext } from '@/components/dashboard/DashboardLayout';
import { Sparkles, RefreshCw, AlertCircle, CheckCircle2, ShieldAlert, MapPin } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { AiSummary, SelectedPlace } from '@/types';

export interface AiBriefPageProps {
  initialSummary?: AiSummary | null;
  initialPlace?: SelectedPlace;
}

export const AiBriefPage: React.FC<AiBriefPageProps> = ({ initialSummary = null, initialPlace }) => {
  const dashboardContext = useDashboardContext();
  const selectedPlace = initialPlace ?? dashboardContext?.selectedPlace;
  const setSelectedPlace = dashboardContext?.setSelectedPlace ?? (() => {});

  const [summary, setSummary] = useState<AiSummary | null>(initialSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In-flight guard to prevent duplicate rapid requests caused by repeated rendering or state changes
  const inFlightRef = useRef(false);

  const place: SelectedPlace = selectedPlace || {
    name: 'Delhi NCR Central Environmental Observatory',
    lat: 28.6139,
    lon: 77.2090,
    kind: 'point',
    details: [
      'National Capital Region, India',
      'Air quality telemetry active via CAMS South Asia model',
      'Delhi Central Ridge ecological reserve bounded within 3.5 km',
    ],
  };

  const PRESET_PLACES: SelectedPlace[] = [
    {
      name: 'Delhi NCR',
      lat: 28.6139,
      lon: 77.2090,
      kind: 'point',
      details: ['Indo-Gangetic Basin Particulate Dispersion Center', 'CAMS Atmospheric Model'],
    },
    {
      name: 'Pune & Western Ghats',
      lat: 18.5204,
      lon: 73.8567,
      kind: 'point',
      details: ['Deccan Plateau urban-forest interface', 'CAMS live atmospheric feed'],
    },
    {
      name: 'Mumbai Coastal',
      lat: 19.0760,
      lon: 72.8777,
      kind: 'point',
      details: ['Arabian Sea coastal boundary layer', 'Metropolitan emissions corridor'],
    },
    {
      name: 'Sundarbans Delta',
      lat: 21.9500,
      lon: 88.8500,
      kind: 'point',
      details: ['Tidal mangrove forest delta buffer', 'Coastal salinity and storm vulnerability'],
    },
    {
      name: 'Western Ghats (Nilgiri)',
      lat: 11.4500,
      lon: 76.6500,
      kind: 'point',
      details: ['UNESCO World Heritage tropical evergreen corridor', 'GFW satellite surveillance AOI'],
    },
    {
      name: 'Bengaluru Plateau',
      lat: 12.9716,
      lon: 77.5946,
      kind: 'point',
      details: ['Southern plateau watershed & urban heat island monitoring'],
    },
  ];

  const handleGenerateBrief = useCallback(async () => {
    if (loading || inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await api<AiSummary>('/ai/summary', {
        method: 'POST',
        json: { name: place.name, lat: place.lat, lon: place.lon },
      });
      setSummary(res);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : 'Could not generate environmental brief at this time.');
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [loading, place.name, place.lat, place.lon]);

  // Parse synthesized brief into structured sections
  const parsedSections = useMemo(() => {
    if (!summary?.summary) return null;
    const text = summary.summary;
    const lines = text.split('\n').filter((l: string) => l.trim().length > 0);

    return {
      overview: lines[0] || text,
      bodyLines: lines.slice(1),
    };
  }, [summary?.summary]);

  const isFallbackActive = !!summary && (summary.fallback || (summary.source === 'rule-based' && summary.fallbackReason !== undefined));

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      {/* 1. Header & Target Selector */}
      <div className="p-4 sm:p-6 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-emerald-950/80 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
              <h2 className="text-lg sm:text-xl font-bold font-serif text-[#F2F5F2] tracking-tight">
                AI Environmental Intelligence Brief
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#9CAEA2]">
              Real-time environmental synthesis grounded in NASA FIRMS, Copernicus CAMS, and Global Forest Watch.
            </p>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <span className="text-xs font-mono text-[#9CAEA2] mr-1">Presets:</span>
            {PRESET_PLACES.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  setSelectedPlace(p);
                  setSummary(null);
                  setError(null);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  place.name === p.name
                    ? 'bg-[#174C34] text-emerald-300 border border-emerald-600/70 font-semibold'
                    : 'bg-[#14251C] text-[#9CAEA2] hover:text-[#F2F5F2] border border-emerald-900/60'
                }`}
              >
                {p.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Selected target display */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-xl bg-[#0D1914] border border-emerald-950/80 min-w-0">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-[#174C34]/50 border border-emerald-600/60 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-bold font-serif text-[#F2F5F2] truncate">{place.name}</h3>
              <p className="text-xs text-emerald-400 font-mono mt-0.5">
                {place.lat.toFixed(4)}°N, {place.lon.toFixed(4)}°E · 150 km Multi-Sensor Radius
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateBrief}
            disabled={loading}
            className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-[#174C34] to-[#1F6244] hover:from-[#1F6244] hover:to-[#2E8B57] disabled:opacity-60 text-xs sm:text-sm font-bold text-[#F2F5F2] border border-emerald-500/60 shadow-md shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-emerald-300" />}
            <span>{loading ? 'Synthesizing Brief…' : summary ? 'Regenerate Brief' : 'Generate AI Risk Brief'}</span>
          </button>
        </div>
      </div>

      {/* 2. Error Display (only if no usable summary exists) */}
      {!summary && error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-900/60 text-xs sm:text-sm text-red-200 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Small, Unobtrusive Fallback Notice when AI service is unavailable */}
      {isFallbackActive && (
        <div
          data-testid="ai-fallback-notice"
          className="p-3.5 sm:p-4 rounded-xl bg-amber-950/40 border border-amber-900/60 text-xs sm:text-sm text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm min-w-0"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="leading-snug">
              AI service temporarily unavailable. Showing an environmental analysis based on available data.
            </span>
          </div>
          <button
            type="button"
            onClick={handleGenerateBrief}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-amber-900/60 hover:bg-amber-800/80 text-amber-100 border border-amber-700/60 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-300 ${loading ? 'animate-spin' : ''}`} />
            <span>Retry AI Brief</span>
          </button>
        </div>
      )}

      {/* 4. Structured Environmental Brief Output */}
      {summary ? (
        <div className="space-y-4 sm:space-y-6 min-w-0">
          {/* Metadata pill bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl bg-[#101F18] border border-emerald-950 text-xs min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`px-2.5 py-1 rounded-md border font-semibold text-xs ${
                  summary.source === 'gemini'
                    ? 'border-emerald-600/60 bg-emerald-950/70 text-emerald-300'
                    : 'border-amber-700/60 bg-amber-950/60 text-amber-300'
                }`}
              >
                {summary.source === 'gemini'
                  ? 'Google Gemini Intelligence'
                  : summary.fallback
                    ? 'Rule-Based Analytical Brief (Fallback)'
                    : 'Rule-Based Analytical Brief'}
              </span>
              <span className="text-[#9CAEA2]">
                Active Telemetry: {summary.context.fires.count} thermal detections within {summary.context.radiusKm} km
              </span>
            </div>

            <span className="text-[#82978B] font-mono text-[11px]">
              Observed: {new Date(summary.generatedAt).toLocaleTimeString()}
            </span>
          </div>

          {/* Structured 3-Card Assessment Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
            {/* 1. Current Situation */}
            <div className="p-4 sm:p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-3 min-w-0">
              <div className="flex items-center gap-2 pb-2 border-b border-emerald-950/80">
                <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0" />
                <h4 className="text-sm sm:text-base font-bold font-serif text-[#F2F5F2]">1. Current Situation</h4>
              </div>
              <p className="text-xs sm:text-sm text-[#CBDAD0] leading-relaxed">
                {parsedSections?.overview || summary.summary}
              </p>
            </div>

            {/* 2. Potential Impacts */}
            <div className="p-4 sm:p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-3 min-w-0">
              <div className="flex items-center gap-2 pb-2 border-b border-emerald-950/80">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <h4 className="text-sm sm:text-base font-bold font-serif text-[#F2F5F2]">2. Potential Impacts</h4>
              </div>
              <div className="text-xs sm:text-sm text-[#CBDAD0] leading-relaxed space-y-2">
                {parsedSections?.bodyLines && parsedSections.bodyLines.length > 0 ? (
                  parsedSections.bodyLines.map((line: string, idx: number) => (
                    <p key={idx}>{line}</p>
                  ))
                ) : (
                  <p>
                    Particulate inhalation hazard and potential thermal stress on local ecosystems within observation perimeter.
                  </p>
                )}
              </div>
            </div>

            {/* 3. Recommended Actions */}
            <div className="p-4 sm:p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-3 min-w-0">
              <div className="flex items-center gap-2 pb-2 border-b border-emerald-950/80">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <h4 className="text-sm sm:text-base font-bold font-serif text-[#F2F5F2]">3. Recommendations</h4>
              </div>
              <ul className="text-xs sm:text-sm text-[#CBDAD0] space-y-2 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                  <span>Maintain continuous observation for atmospheric particulate dispersion.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                  <span>Alert regional monitoring cells if thermal anomalies exceed 80 MW FRP.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                  <span>Validate canopy disturbance boundaries against satellite tracking passes.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-10 sm:p-14 rounded-xl bg-[#101F18] border border-dashed border-emerald-950/80 text-center space-y-2.5">
          <Sparkles className="w-8 h-8 text-emerald-400/60 mx-auto" />
          <h3 className="text-base sm:text-lg font-bold font-serif text-[#F2F5F2]">No Brief Generated Yet</h3>
          <p className="text-xs sm:text-sm text-[#9CAEA2] max-w-md mx-auto">
            Click "Generate AI Risk Brief" to synthesize real-time environmental analysis for {place.name}.
          </p>
        </div>
      )}
    </div>
  );
};

export default AiBriefPage;
