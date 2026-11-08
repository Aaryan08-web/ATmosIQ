"use client";

import React from "react";
import {
  Globe,
  LayoutDashboard,
  Flame,
  Wind,
  TreeDeciduous,
  Activity,
  Settings,
  HelpCircle,
} from "lucide-react";
import { useAppSidebar } from "./sidebar";
import { cn } from "@/lib/utils";

export function App1Sidebar() {
  const { open } = useAppSidebar();

  const links = [
    { label: "Overview", icon: LayoutDashboard, active: true },
    { label: "Active Fires", icon: Flame },
    { label: "Air Quality", icon: Wind },
    { label: "Forest Loss", icon: TreeDeciduous },
    { label: "Risk Analytics", icon: Activity },
    { label: "Settings", icon: Settings },
    { label: "Documentation", icon: HelpCircle },
  ];

  if (!open) return null;

  return (
    <aside className="w-64 border-r border-emerald-950/80 bg-[#0D1914] flex flex-col justify-between p-4 shrink-0">
      <div>
        <div className="flex items-center gap-2.5 px-2 py-3 border-b border-emerald-950 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[#174C34] flex items-center justify-center text-emerald-400">
            <Globe className="w-4 h-4" />
          </div>
          <span className="font-bold text-base tracking-tight text-[#F2F5F2]">ATmosIQ</span>
        </div>

        <nav className="space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.label}
                type="button"
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left",
                  link.active
                    ? "bg-[#174C34]/40 text-emerald-300 border border-emerald-800/50"
                    : "text-[#9CAEA2] hover:text-[#F2F5F2] hover:bg-[#101F18]"
                )}
              >
                <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{link.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="text-[10px] text-[#9CAEA2] font-mono px-2 py-2 border-t border-emerald-950">
        ATmosIQ Platform v2.4
      </div>
    </aside>
  );
}

