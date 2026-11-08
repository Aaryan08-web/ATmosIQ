"use client";
import React from "react";
import { Globe, GlobeSvg, GlobePin, GlobeGlow } from "@/components/ui/globe";
import { Pulse } from "@/components/ui/globe-utils/pulse";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/globe-utils/tooltip";
import { Activity, ShieldAlert, Wind, Thermometer, Radio } from "lucide-react";

interface AuthGlobeBackgroundProps {
  className?: string;
}

export function AuthGlobeBackground({ className = "" }: AuthGlobeBackgroundProps) {
  const observationPoints = [
    {
      city: "Delhi",
      type: "Atmospheric Risk Monitoring",
      x: 895,
      y: 160,
      icon: ShieldAlert,
      metric: "AQI Index: 148 (Simulated)",
      status: "Telemetry Active",
      subtext: "Surface particulate & NO2 column trace",
    },
    {
      city: "Mumbai",
      type: "Environmental Observation",
      x: 875,
      y: 188,
      icon: Activity,
      metric: "Coastal SST Anomaly: +0.6°C",
      status: "Radar Linked",
      subtext: "Arabian Sea marine boundary layer",
    },
    {
      city: "Pune",
      type: "Air Quality Monitoring",
      x: 890,
      y: 202,
      icon: Wind,
      metric: "PM2.5: 38 µg/m³ (Simulated)",
      status: "Sub-daily Cycle",
      subtext: "Western Ghats microclimate telemetry",
    },
    {
      city: "Bengaluru",
      type: "Climate Observation",
      x: 905,
      y: 222,
      icon: Thermometer,
      metric: "Canopy Heat Index: 26.4°C",
      status: "Multi-Sensor",
      subtext: "Urban heat island & green cover index",
    },
  ];

  return (
    <div className={`absolute inset-0 overflow-hidden select-none pointer-events-none ${className}`}>
      {/* Ambient environmental glows */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-emerald-950/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[350px] bg-[#174C34]/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 left-10 w-[350px] h-[350px] bg-emerald-900/15 rounded-full blur-[90px] pointer-events-none" />

      {/* Subtle orbital atmospheric grid layer */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(46,139,87,0.06)_0,transparent_70%)] pointer-events-none" />

      <TooltipProvider delayDuration={150}>
        <div className="w-full h-full flex items-center justify-center p-4 sm:p-8">
          <Globe className="w-full max-w-6xl opacity-90 transition-opacity duration-700">
            <GlobeGlow className="bg-emerald-950/20 blur-2xl" />

            <GlobeSvg className="filter drop-shadow-[0_0_24px_rgba(0,214,160,0.12)]">
              {/* Observation pins & interactive telemetry pulses */}
              {observationPoints.map((point) => {
                const Icon = point.icon;
                return (
                  <g key={point.city}>
                    {/* Visual map pin indicator */}
                    <GlobePin x={point.x} y={point.y} />

                    {/* Interactive ForeignObject Tooltip Target */}
                    <foreignObject
                      x={point.x - 14}
                      y={point.y - 14}
                      width={28}
                      height={28}
                      className="overflow-visible pointer-events-auto"
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label={`${point.city} - ${point.type}`}
                            className="size-full flex justify-center items-center cursor-pointer p-0 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-emerald-400 rounded-full group"
                          >
                            <Pulse className="[&>*:last-child]:group-hover:scale-125 transition-transform" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          sideOffset={8}
                          className="w-64 p-3 bg-[#101F18]/95 border border-emerald-800/80 rounded-xl shadow-2xl backdrop-blur-md text-[#F2F5F2]"
                        >
                          <div className="flex items-center justify-between border-b border-emerald-950/80 pb-2 mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              <span className="font-bold text-xs text-[#F2F5F2]">{point.city}</span>
                            </div>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 font-semibold tracking-wider">
                              DEMO DATA
                            </span>
                          </div>

                          <div className="flex items-start gap-2 mb-2">
                            <div className="w-6 h-6 rounded bg-[#174C34]/40 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-[#F2F5F2]">{point.type}</p>
                              <p className="text-[10px] text-[#9CAEA2] leading-tight">{point.subtext}</p>
                            </div>
                          </div>

                          <div className="bg-[#0B1713] border border-emerald-950 rounded-lg p-2 flex items-center justify-between text-[11px] font-mono">
                            <span className="text-emerald-400 font-medium">{point.metric}</span>
                            <span className="text-[10px] text-[#9CAEA2] flex items-center gap-1">
                              <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                              {point.status}
                            </span>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </foreignObject>
                  </g>
                );
              })}
            </GlobeSvg>
          </Globe>
        </div>
      </TooltipProvider>

      {/* Subtle bottom environmental intelligence footer indicator */}
      <div className="absolute bottom-4 left-6 hidden md:flex items-center gap-3 text-[11px] font-mono text-[#9CAEA2]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[#F2F5F2]">OBSERVATION TELEMETRY: DEMO DATA</span>
        </div>
        <span>·</span>
        <span>HOVER MARKERS FOR STATION INSIGHTS</span>
      </div>
    </div>
  );
}

export default AuthGlobeBackground;
