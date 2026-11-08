import React from 'react';
import {
  TreeDeciduous,
  Wind,
  Droplets,
  Activity,
  Map,
  Cpu,
  Target,
  FileCheck2,
  Shield,
  Lock,
  Leaf,
} from 'lucide-react';
import { OrbitDeliveryHero } from '@/components/ui/orbit-delivery-hero';

interface LandingPageProps {
  onNavigate: (route: string) => void;
  isAuthenticated: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigate,
  isAuthenticated,
}) => {
  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const features = [
    {
      num: '01',
      title: 'Environmental Monitoring',
      description: 'Analyse real-time environmental, fire anomalies, and atmospheric conditions.',
      icon: Activity,
      tag: 'Continuous Telemetry',
    },
    {
      num: '02',
      title: 'Geospatial Risk Mapping',
      description: 'Identify and visualise high-risk ecological zones with custom GIS polygon buffers.',
      icon: Map,
      tag: 'GIS Risk Layers',
    },
    {
      num: '03',
      title: 'AI Risk Prediction',
      description: 'Forecast potential environmental threats and emerging vulnerability horizons.',
      icon: Cpu,
      tag: 'Predictive Neural Models',
    },
    {
      num: '04',
      title: 'Smart Interventions',
      description: 'Prioritise critical biomes and ecological zones requiring immediate attention.',
      icon: Target,
      tag: 'Priority Intervention',
    },
  ];

  return (
    <OrbitDeliveryHero
      onNavigate={onNavigate}
      isAuthenticated={isAuthenticated}
      onScrollToSection={scrollTo}
    >
      {/* Section 1: Capabilities (#capabilities) */}
      <section
        id="capabilities"
        className="px-6 sm:px-12 py-20 sm:py-28 bg-[#101F18] border-t border-emerald-950 scroll-mt-28 md:scroll-mt-20"
      >
        <div className="max-w-6xl mx-auto">
          <div className="mb-14 text-left">
            <span className="text-sm sm:text-base font-mono text-emerald-400 uppercase tracking-widest font-bold">
              MISSION CAPABILITIES
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-[#F2F5F2] mt-3 tracking-tight">
              Autonomous Planetary Risk Intelligence
            </h2>
            <p className="text-lg sm:text-xl text-[#CBDAD0] mt-4 max-w-3xl leading-relaxed">
              High-cadence multi-sensor observation pipelines analyzing ecosystem vulnerability,
              carbon displacement, and ecological threat dynamics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-[#0B1713] border border-emerald-950/80 hover:border-emerald-600/50 transition-colors flex flex-col justify-between shadow-sm">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-[#174C34]/40 text-emerald-400 flex items-center justify-center mb-6 border border-emerald-800/40">
                  <TreeDeciduous className="w-7 h-7" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-[#F2F5F2]">Forest-Loss Hotspots</h3>
                <p className="mt-4 text-base sm:text-lg text-[#CBDAD0] leading-relaxed">
                  A curated map of the world's most pressured forest regions, with the main driver
                  of loss (ranching, plantations, charcoal, fire) for each, based on Global Forest Watch reporting.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-emerald-950 flex items-center justify-between text-sm sm:text-base font-mono text-emerald-400 font-semibold">
                <span>Reference dataset</span>
                <span>Global Forest Watch</span>
              </div>
            </div>

            <div className="p-8 rounded-2xl bg-[#0B1713] border border-emerald-950/80 hover:border-emerald-600/50 transition-colors flex flex-col justify-between shadow-sm">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-[#174C34]/40 text-emerald-400 flex items-center justify-center mb-6 border border-emerald-800/40">
                  <Wind className="w-7 h-7" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-[#F2F5F2]">Active Fire Detection</h3>
                <p className="mt-4 text-base sm:text-lg text-[#CBDAD0] leading-relaxed">
                  Near-real-time satellite thermal detections show where fires are burning right now,
                  ranked by fire radiative power, refreshed every 15 minutes.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-emerald-950 flex items-center justify-between text-sm sm:text-base font-mono text-emerald-400 font-semibold">
                <span>Last 24 hours</span>
                <span>NASA FIRMS · VIIRS</span>
              </div>
            </div>

            <div className="p-8 rounded-2xl bg-[#0B1713] border border-emerald-950/80 hover:border-emerald-600/50 transition-colors flex flex-col justify-between shadow-sm">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-[#174C34]/40 text-emerald-400 flex items-center justify-center mb-6 border border-emerald-800/40">
                  <Droplets className="w-7 h-7" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-[#F2F5F2]">Air Quality Monitoring</h3>
                <p className="mt-4 text-base sm:text-lg text-[#CBDAD0] leading-relaxed">
                  Current US AQI and PM2.5 for 45 major cities, with health categories, so you can see
                  where air is unsafe and how it relates to nearby fires.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-emerald-950 flex items-center justify-between text-sm sm:text-base font-mono text-emerald-400 font-semibold">
                <span>US AQI · PM2.5</span>
                <span>Open-Meteo / CAMS</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: What ATmosIQ Does / Features (#features & #risk-vectors) */}
      <section
        id="features"
        className="relative px-6 sm:px-12 py-20 sm:py-28 bg-[#0B1713] border-t border-emerald-950 scroll-mt-28 md:scroll-mt-20 overflow-hidden"
      >
        <div id="risk-vectors" className="absolute -top-28 left-0 pointer-events-none opacity-0" />

        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm sm:text-base font-mono text-emerald-400 uppercase tracking-widest font-bold">
                  WHAT ATMOSIQ DOES
                </span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-[#F2F5F2] tracking-tight flex items-center gap-3 flex-wrap">
                <span>ATmosIQ</span>
                <Leaf className="w-8 h-8 text-emerald-400 fill-emerald-400/40 inline-block" />
                <span>– Environmental Intelligence, Powered by AI</span>
              </h2>
              <p className="text-lg sm:text-xl text-[#CBDAD0] mt-4 max-w-3xl leading-relaxed">
                “Transforming environmental and atmospheric data into actionable intelligence to identify vulnerable zones, predict emerging environmental risks, and support smarter environmental decisions.”
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('/dashboard')}
              className="px-6 py-3.5 bg-[#101F18] border border-emerald-700/60 hover:border-emerald-400 text-base font-bold text-[#F2F5F2] rounded-xl transition-all cursor-pointer shrink-0 self-start md:self-end shadow-sm"
            >
              Access Live GIS Console →
            </button>
          </div>

          {/* 4 Core Capabilities Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="group relative p-8 rounded-2xl bg-[#101F18] border border-emerald-950/80 hover:border-emerald-500/50 hover:bg-[#12241C] transition-all duration-200 flex flex-col justify-between shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-14 h-14 rounded-2xl bg-[#174C34]/40 border border-emerald-900/50 text-emerald-400 flex items-center justify-center group-hover:bg-[#174C34] group-hover:text-emerald-300 transition-colors">
                        <Icon className="w-7 h-7" />
                      </div>
                      <span className="text-base font-mono text-emerald-400 font-bold tracking-wider">
                        {feat.num}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-[#F2F5F2] tracking-tight">
                      {feat.title}
                    </h3>
                    <p className="mt-3.5 text-base sm:text-lg text-[#CBDAD0] leading-relaxed">
                      {feat.description}
                    </p>
                  </div>

                  <div className="mt-8 pt-4 border-t border-emerald-950/80 flex items-center justify-between text-sm font-mono text-emerald-400 font-semibold">
                    <span>{feat.tag}</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 3: Satellite Grid (#satellite-grid) */}
      <section
        id="satellite-grid"
        className="px-6 sm:px-12 py-20 sm:py-28 bg-[#101F18] border-t border-emerald-950 scroll-mt-28 md:scroll-mt-20"
      >
        <div className="max-w-6xl mx-auto">
          <div className="mb-14 text-left">
            <span className="text-sm sm:text-base font-mono text-emerald-400 uppercase tracking-widest font-bold">
              CONSTELLATION TELEMETRY
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-[#F2F5F2] mt-3 tracking-tight">
              Integrated Satellite Grid
            </h2>
            <p className="text-lg sm:text-xl text-[#CBDAD0] mt-4 max-w-3xl leading-relaxed">
              Coordinated Earth Observation orbits synchronizing optical multispectral, C-band radar,
              and atmospheric sounding instruments.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-7 rounded-2xl bg-[#0B1713] border border-emerald-950 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between text-sm font-mono text-[#A8BCAE] mb-3.5 font-semibold">
                  <span>ESA Copernicus</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="text-xl font-bold text-[#F2F5F2]">Sentinel-1A/B</div>
                <div className="text-sm text-emerald-400 font-mono mt-1.5 font-semibold">
                  C-Band Synthetic Aperture Radar
                </div>
                <p className="text-base text-[#CBDAD0] mt-4 leading-relaxed">
                  All-weather day-and-night surface deformation and canopy roughness tracking.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-emerald-950 text-sm font-mono text-[#A8BCAE]">
                Cadence: 6 Days · 786 km Orbit
              </div>
            </div>

            <div className="p-7 rounded-2xl bg-[#0B1713] border border-emerald-950 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between text-sm font-mono text-[#A8BCAE] mb-3.5 font-semibold">
                  <span>ESA Copernicus</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="text-xl font-bold text-[#F2F5F2]">Sentinel-2A/B</div>
                <div className="text-sm text-emerald-400 font-mono mt-1.5 font-semibold">
                  13-Band Multispectral MSI
                </div>
                <p className="text-base text-[#CBDAD0] mt-4 leading-relaxed">
                  Red-edge vegetation indexing, chlorophyll absorption, and inland water turbidity.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-emerald-950 text-sm font-mono text-[#A8BCAE]">
                Cadence: 5 Days · 10m Ground Res
              </div>
            </div>

            <div className="p-7 rounded-2xl bg-[#0B1713] border border-emerald-950 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between text-sm font-mono text-[#A8BCAE] mb-3.5 font-semibold">
                  <span>NASA / USGS</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="text-xl font-bold text-[#F2F5F2]">Landsat-9</div>
                <div className="text-sm text-emerald-400 font-mono mt-1.5 font-semibold">
                  OLI-2 &amp; TIRS-2 Sensors
                </div>
                <p className="text-base text-[#CBDAD0] mt-4 leading-relaxed">
                  Calibrated thermal infrared radiometry and global land-use change benchmarks.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-emerald-950 text-sm font-mono text-[#A8BCAE]">
                Cadence: 8 Days · 14-Bit Radiometric
              </div>
            </div>

            <div className="p-7 rounded-2xl bg-[#0B1713] border border-emerald-950 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between text-sm font-mono text-[#A8BCAE] mb-3.5 font-semibold">
                  <span>ESA Copernicus</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="text-xl font-bold text-[#F2F5F2]">Sentinel-5P (TROPOMI)</div>
                <div className="text-sm text-emerald-400 font-mono mt-1.5 font-semibold">
                  Tropospheric Spectrometer
                </div>
                <p className="text-base text-[#CBDAD0] mt-4 leading-relaxed">
                  Atmospheric column densities of methane (CH4), carbon monoxide (CO), and ozone (O3).
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-emerald-950 text-sm font-mono text-[#A8BCAE]">
                Cadence: Daily · Global Coverage
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Science & Compliance (#governance) */}
      <section
        id="governance"
        className="px-6 sm:px-12 py-20 sm:py-28 bg-[#0B1713] border-t border-emerald-950 scroll-mt-28 md:scroll-mt-20"
      >
        <div className="max-w-6xl mx-auto">
          <div className="mb-14 text-left">
            <span className="text-sm sm:text-base font-mono text-emerald-400 uppercase tracking-widest font-bold">
              STANDARDS &amp; GOVERNANCE
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-[#F2F5F2] mt-3 tracking-tight">
              Scientific Rigor &amp; Global Compliance
            </h2>
            <p className="text-lg sm:text-xl text-[#CBDAD0] mt-4 max-w-3xl leading-relaxed">
              Every data point produced by ATmosIQ adheres to internationally audited open science
              standards and United Nations environmental frameworks.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-[#101F18] border border-emerald-950 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-[#174C34]/40 text-emerald-400 flex items-center justify-center mb-6 border border-emerald-800/40">
                <FileCheck2 className="w-7 h-7" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#F2F5F2]">Transparent Data Sources</h3>
              <p className="mt-4 text-base sm:text-lg text-[#CBDAD0] leading-relaxed">
                Every figure on the platform shows its source and the time it was fetched, and sample or reference data is always labelled as such.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-[#101F18] border border-emerald-950 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-[#174C34]/40 text-emerald-400 flex items-center justify-center mb-6 border border-emerald-800/40">
                <Shield className="w-7 h-7" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#F2F5F2]">Aligned with UN SDG 13 &amp; 15</h3>
              <p className="mt-4 text-base sm:text-lg text-[#CBDAD0] leading-relaxed">
                The platform supports UN Sustainable Development Goal 13 (Climate Action) and Goal 15 (Life on Land) by making fire, air and forest risk easier to see.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-[#101F18] border border-emerald-950 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-[#174C34]/40 text-emerald-400 flex items-center justify-center mb-6 border border-emerald-800/40">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#F2F5F2]">AI You Can Check</h3>
              <p className="mt-4 text-base sm:text-lg text-[#CBDAD0] leading-relaxed">
                AI risk briefs use only the measurements shown on screen, are labelled as AI-generated, and never invent numbers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-emerald-950 px-6 sm:px-12 py-12 text-sm text-[#CBDAD0] bg-[#0E1A14]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-extrabold text-[#F2F5F2] text-lg sm:text-xl flex items-center gap-2">
              ATmosIQ
              <Leaf className="w-5 h-5 text-emerald-400 fill-emerald-400/40" />
            </span>
            <span>·</span>
            <span className="text-emerald-400 font-mono text-xs sm:text-sm font-bold tracking-wider">
              ENVIRONMENTAL INTELLIGENCE
            </span>
            <span>·</span>
            <span className="text-xs sm:text-sm text-[#A8BCAE]">
              Planetary Observation System © 2026
            </span>
          </div>

          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="text-[#CBDAD0] hover:text-[#F2F5F2] text-sm sm:text-base font-semibold transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/signup')}
              className="text-[#CBDAD0] hover:text-[#F2F5F2] text-sm sm:text-base font-semibold transition-colors cursor-pointer"
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/dashboard')}
              className="text-emerald-400 hover:text-emerald-300 font-bold text-sm sm:text-base transition-colors cursor-pointer"
            >
              Console Dashboard →
            </button>
          </div>
        </div>
      </footer>
    </OrbitDeliveryHero>
  );
};
