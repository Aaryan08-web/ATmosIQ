import React, { useMemo, useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Menu,
  Bell,
  Calendar,
  Leaf,
  ChevronDown,
  RotateCcw,
  Check,
} from 'lucide-react';
import type { User } from '@/types';

interface HeaderProps {
  user: User;
  onOpenMobileSidebar: () => void;
  activeAlertCount?: number;
}

export const DashboardHeader: React.FC<HeaderProps> = ({
  user,
  onOpenMobileSidebar,
  activeAlertCount = 0,
}) => {

  const getTodayISO = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  // Custom date selection defaulting to today's date on open
  const [customDate, setCustomDate] = useState<string>(getTodayISO);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDatePicker]);

  const formattedDate = useMemo(() => {
    if (!customDate) return todayStr;
    try {
      const [y, m, d] = customDate.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return todayStr;
    }
  }, [customDate, todayStr]);

  const isToday = customDate === getTodayISO();

  return (
    <header className="h-16 px-4 sm:px-6 bg-[#0D1914]/90 backdrop-blur-md border-b border-emerald-950/80 sticky top-0 z-20 flex items-center justify-between gap-4">
      {/* Left: Mobile Toggle & Breadcrumb / Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="p-1.5 -ml-1 text-[#9CAEA2] hover:text-[#F2F5F2] hover:bg-[#14251C] rounded-lg md:hidden shrink-0 border border-emerald-950"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <NavLink
          to="/dashboard"
          className="flex items-center gap-2 text-lg sm:text-xl font-bold text-[#F2F5F2] hover:text-emerald-400 transition-colors tracking-tight focus:outline-none"
        >
          <span>ATmosIQ</span>
          <Leaf className="w-4 h-4 text-emerald-400 fill-emerald-400/40 shrink-0" />
        </NavLink>
      </div>

      {/* Right: Actions, Date, Alert Pill & User Info */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Interactive Custom Date Picker defaulting to today */}
        <div className="relative" ref={datePickerRef}>
          <button
            type="button"
            onClick={() => setShowDatePicker((prev) => !prev)}
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#101F18] hover:bg-[#14251C] border border-emerald-950 hover:border-emerald-800 text-[13px] text-[#9CAEA2] hover:text-[#F2F5F2] transition-colors cursor-pointer"
            title="Click to select a custom date (defaults to today)"
            aria-label="Select custom date"
          >
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span className="font-medium text-[#F2F5F2]">{formattedDate}</span>
            {isToday ? (
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60">
                Today
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-amber-400 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800/60">
                Custom
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-[#9CAEA2]" />
          </button>

          {showDatePicker && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-[#0D1914] border border-emerald-900/80 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-emerald-950/80">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Telemetry Observation Date
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomDate(getTodayISO());
                  }}
                  className="text-[11px] flex items-center gap-1 text-[#9CAEA2] hover:text-emerald-300 transition-colors cursor-pointer"
                  title="Reset to today"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] text-[#9CAEA2] mb-1.5 font-medium">
                    Pick Custom Date:
                  </label>
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => {
                      if (e.target.value) setCustomDate(e.target.value);
                    }}
                    max={getTodayISO()}
                    className="w-full bg-[#101F18] border border-emerald-900/80 text-[#F2F5F2] text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 [color-scheme:dark]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomDate(getTodayISO());
                      setShowDatePicker(false);
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#14251C] hover:bg-emerald-900/40 text-emerald-300 border border-emerald-800/50 transition-colors cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      const y = d.getFullYear();
                      const m = String(d.getMonth() + 1).padStart(2, '0');
                      const day = String(d.getDate()).padStart(2, '0');
                      setCustomDate(`${y}-${m}-${day}`);
                      setShowDatePicker(false);
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#14251C] hover:bg-emerald-900/40 text-[#9CAEA2] hover:text-[#F2F5F2] border border-emerald-900/50 transition-colors cursor-pointer"
                  >
                    Yesterday
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDatePicker(false)}
                  className="w-full mt-2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Apply Date</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Alerts quick icon */}
        <NavLink
          to="/dashboard/alerts"
          className="relative p-2 rounded-lg bg-[#101F18] hover:bg-[#14251C] text-[#9CAEA2] hover:text-[#F2F5F2] border border-emerald-950 transition-colors"
          title={`${activeAlertCount} active environmental alerts`}
        >
          <Bell className="w-4 h-4" />
          {activeAlertCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#0D1914] animate-pulse" />
          )}
        </NavLink>

        {/* User initials pill */}
        <NavLink
          to="/dashboard/settings"
          className="flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-lg bg-[#101F18] hover:bg-[#14251C] border border-emerald-950 transition-colors group"
        >
          <div className="w-7 h-7 rounded-md bg-[#174C34] text-emerald-300 text-xs font-bold flex items-center justify-center border border-emerald-800/40 group-hover:border-emerald-500">
            {user.avatarInitials || 'AQ'}
          </div>
          <span className="text-[14px] font-medium text-[#F2F5F2] hidden sm:inline-block max-w-[120px] truncate">
            {user.name.split(' ')[0]}
          </span>
        </NavLink>
      </div>
    </header>
  );
};

export default DashboardHeader;
