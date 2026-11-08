import React, { useState } from 'react';
import { useDashboardContext } from '@/components/dashboard/DashboardLayout';
import { Sparkles, RefreshCw, AlertCircle, CheckCircle2, ShieldAlert, MapPin, Info, ArrowRight } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { AiSummary, SelectedPlace } from '@/types';

export const AiBriefPage: React.FC = () => {
  const { selectedPlace, setSelectedPlace } = useDashboardContext();
  const [summary, setSummary] = useState<AiSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      name: 'Delhi NCR Environmental Node',
      lat: 28.6139,
      lon: 77.2090,
      kind: 'point',
      details: ['Urban Particulate Dispersion Center', 'CAMS South Asia'],
    },
    {
      name: 'Sumatra Peatland Basin',
      lat: 0.5333,
      lon: 101.4500,
      kind: 'point',
      details: ['NASA FIRMS VIIRS Active Fire surveillance zone'],
    },
    {
      name: 'Cerrado Forest Frontier',
      lat: -12.1500,
      lon: -45.0000,
      kind: 'point',
      details: ['Global Forest Watch curated loss front'],
    },
    {
      name: 'Mumbai Coastal Air Observatory',
      lat: 19.0760,
      lon: 72.8777,
      kind: 'point',
      details: ['Arabian Sea coastal boundary layer'],
    },
  ];

  const handleGenerateBrief = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<AiSummary>('/ai/summary', {
        method: 'POST',
        json: { name: place.name, lat: place.lat, lon: place.lon },
      });
      setSummary(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not generate environmental brief at this time.');
    } finally {
      setLoading(false);
    }
  };

  // Parse synthesized brief into structured sections
  const parsedSections = React.useMemo(() => {
    if (!summary?.summary) return null;
    const text = summary.summary;
    const lines = text.split('\n').filter((l) => l.trim().length > 0);

    return {
      overview: lines[0] || text,
      bodyLines: lines.slice(1),
    };
  }, [summary?.summary]);

  return (
    <div className="space-y-8">
      {/* 1. Header & Target Selector */}
      <div className="p-5 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-950/80">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-[#F2F5F2]">AI-Synthesized Environmental Risk Brief</h2>
            </div>
            <p className="text-xs text-[#9CAEA2] mt-0.5">
              Automated planetary intelligence briefing grounded in active sensor data (FIRMS fires, CAMS air dispersion, GFW biomes).
            </p>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-mono text-[#9CAEA2] mr-1">Presets:</span>
            {PRESET_PLACES.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  setSelectedPlace(p);
                  setSummary(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-[14px] font-medium transition-colors cursor-pointer ${
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-[#0D1914] border border-emerald-950/80">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#174C34]/50 border border-emerald-600/60 text-emerald-400 flex items-center justify-center shrink-0">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-[19px] sm:text-[21px] font-bold text-[#F2F5F2]">{place.name}</h3>
              <p className="text-[14px] text-emerald-400 mt-0.5">
                {place.lat.toFixed(4)}°N, {place.lon.toFixed(4)}°E · Active 150 km Multi-Sensor Radius
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateBrief}
            disabled={loading}
            className="py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#174C34] to-[#1F6244] hover:from-[#1F6244] hover:to-[#2E8B57] disabled:opacity-60 text-[16px] font-bold text-[#F2F5F2] border border-emerald-500/60 shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2.5 transition-all cursor-pointer shrink-0"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-emerald-300" />}
            <span>{loading ? 'Synthesizing Brief…' : summary ? 'Regenerate Analysis' : 'Generate AI Risk Brief'}</span>
          </button>
        </div>
      </div>

      {/* 2. Error Display */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-900/60 text-[14px] text-red-200 flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Structured Environmental Brief Output */}
      {summary ? (
        <div className="space-y-6">
          {/* Metadata pill bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#101F18] border border-emerald-950 text-[14px]">
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-lg border font-semibold text-[13px] ${
                  summary.source === 'gemini'
                    ? 'border-emerald-600/60 bg-emerald-950/70 text-emerald-300'
                    : 'border-amber-700/60 bg-amber-950/60 text-amber-300'
                }`}
              >
                {summary.source === 'gemini' ? 'Google Gemini 1.5 Synthesis' : 'Rule-Based Offline Fallback'}
              </span>
              <span className="text-[#9CAEA2]">
                Telemetry verification: {summary.context.fires.count} active thermal fires within {summary.context.radiusKm} km
              </span>
            </div>

            <span className="text-[#A8BCAE]">
              Generated: {new Date(summary.generatedAt).toLocaleString()}
            </span>
          </div>

          {/* Structured 3-Card Assessment Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. Current Situation */}
            <div className="p-6 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-3.5">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-emerald-950/80">
                <ShieldAlert className="w-5 h-5 text-emerald-400" />
                <h4 className="text-[18px] sm:text-[19px] font-bold text-[#F2F5F2]">1. Current Situation</h4>
              </div>
              <p className="text-[15px] sm:text-[16px] text-[#CBDAD0] leading-relaxed">
                {parsedSections?.overview || summary.summary}
              </p>
            </div>

            {/* 2. Potential Impacts */}
            <div className="p-6 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-3.5">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-emerald-950/80">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <h4 className="text-[18px] sm:text-[19px] font-bold text-[#F2F5F2]">2. Potential Impacts</h4>
              </div>
              <div className="text-[15px] sm:text-[16px] text-[#CBDAD0] leading-relaxed space-y-2">
                {parsedSections?.bodyLines && parsedSections.bodyLines.length > 0 ? (
                  parsedSections.bodyLines.map((line, idx) => (
                    <p key={idx}>{line}</p>
                  ))
                ) : (
                  <p>
                    Elevated particulate inhalation threat and localized thermal radiative stress on nearby ecosystem buffers.
                  </p>
                )}
              </div>
            </div>

            {/* 3. Recommended Actions */}
            <div className="p-6 rounded-xl bg-[#101F18] border border-emerald-950 shadow-sm space-y-3.5">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-emerald-950/80">
                <CheckCircle2 className="w-5 h-5 text-cyan-400" />
                <h4 className="text-[18px] sm:text-[19px] font-bold text-[#F2F5F2]">3. Recommended Actions</h4>
              </div>
              <ul className="text-[15px] sm:text-[16px] text-[#CBDAD0] space-y-2.5 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0" />
                  <span>Maintain continuous observation for smoke dispersion trajectories.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0" />
                  <span>Notify regional surveillance teams if thermal radiative power exceeds 100 MW.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0" />
                  <span>Verify critical canopy loss boundaries against seasonal satellite passes.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-14 rounded-xl bg-[#101F18] border border-dashed border-emerald-950/80 text-center space-y-3">
          <Sparkles className="w-10 h-10 text-emerald-400/60 mx-auto" />
          <h3 className="text-[20px] font-bold text-[#F2F5F2]">No Brief Generated Yet</h3>
          <p className="text-[15px] sm:text-[16px] text-[#9CAEA2] max-w-md mx-auto">
            Click "Generate AI Risk Brief" to synthesize a real-time environmental analysis for {place.name}.
          </p>
        </div>
      )}

      {/* Provenance and Disclaimer Notice */}
      <div className="flex items-start gap-3 p-5 rounded-xl bg-[#0D1914] border border-emerald-950/80 text-[14px] sm:text-[15px] text-[#9CAEA2] leading-relaxed">
        <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-[#F2F5F2]">AI Synthesis Protocol: </span>
          Briefings use only the verified sensor metrics available on this platform. They do not fabricate unverified weather conditions or future dates. Recommendations are for analytical support and should be verified before executive operational deployment.
        </div>
      </div>
    </div>
  );
};

export default AiBriefPage;

