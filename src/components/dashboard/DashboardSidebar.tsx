import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Globe,
  Map,
  Activity,
  Sparkles,
  Wind,
  Database,
  AlertTriangle,
  Settings,
  LogOut,
  X,
  Leaf,
} from 'lucide-react';
import type { User } from '@/types';

interface SidebarProps {
  user: User;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  title: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavSection {
  category: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    category: 'OVERVIEW',
    items: [
      { title: 'Overview', path: '/dashboard', icon: Globe },
      { title: 'Environmental Risk Map', path: '/dashboard/map', icon: Map },
    ],
  },
  {
    category: 'INTELLIGENCE',
    items: [
      { title: 'Atmospheric Intelligence', path: '/dashboard/atmospheric', icon: Wind },
      { title: 'Risk Analysis', path: '/dashboard/risk-analysis', icon: Activity },
      { title: 'AI Environmental Brief', path: '/dashboard/ai-brief', icon: Sparkles, badge: 'Neural' },
    ],
  },
  {
    category: 'OPERATIONS',
    items: [
      { title: 'Alerts & Events', path: '/dashboard/alerts', icon: AlertTriangle, badge: 'Live' },
      { title: 'Data Sources', path: '/dashboard/data-sources', icon: Database },
    ],
  },
  {
    category: 'SYSTEM',
    items: [
      { title: 'Settings', path: '/dashboard/settings', icon: Settings },
    ],
  },
];

export const DashboardSidebar: React.FC<SidebarProps> = ({
  user,
  onLogout,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const location = useLocation();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const prefersReducedMotion = useReducedMotion();
  const animationTransition = prefersReducedMotion
    ? { duration: 0.01 }
    : { duration: 0.3, ease: 'easeInOut' as const };

  // In desktop mode: expanded if either not pinned-collapsed OR actively hovered
  const isDesktopExpanded = !collapsed || isHovered;

  // Close mobile drawer and profile popover on route change
  useEffect(() => {
    onCloseMobile();
    setShowProfileMenu(false);
  }, [location.pathname, onCloseMobile]);

  // Lock background scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const renderSidebarContent = (isExpanded: boolean) => (
    <div className="flex flex-col h-full bg-[#0D1914] border-r border-emerald-950/80 text-[#F2F5F2] select-none">
      {/* Header / Brand Row with animated Logo */}
      <div className="h-20 flex items-center justify-between px-3.5 border-b border-emerald-950/80 shrink-0">
        <NavLink
          to="/dashboard"
          onClick={() => {
            if (collapsed) onToggleCollapse();
          }}
          className="flex items-center gap-3 overflow-hidden group focus:outline-none cursor-pointer"
          title="ATmosIQ Environmental Intelligence"
        >
          {/* Logo Icon (always visible and properly aligned) */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#174C34] via-[#103323] to-[#0A1F16] flex items-center justify-center text-emerald-400 shrink-0 border border-emerald-500/60 group-hover:border-emerald-400 transition-colors shadow-[0_0_15px_rgba(52,211,153,0.25)]">
            <Leaf className="w-5 h-5 text-emerald-400 fill-emerald-500/40 -rotate-12 transition-transform duration-300 group-hover:scale-110" />
          </div>

          {/* Full Product Name (slides and fades smoothly in expanded mode) */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, x: -8, width: 0 }}
                animate={{ opacity: 1, x: 0, width: 'auto' }}
                exit={{ opacity: 0, x: -8, width: 0 }}
                transition={animationTransition}
                className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap pl-0.5"
              >
                <span className="font-bold text-[22px] text-[#F2F5F2] tracking-tight truncate">
                  ATmosIQ
                </span>
                <Leaf className="w-4 h-4 text-emerald-400 fill-emerald-400/40 shrink-0" />
              </motion.div>
            )}
          </AnimatePresence>
        </NavLink>

        {/* Mobile Close Button */}
        <button
          type="button"
          onClick={onCloseMobile}
          className="flex md:hidden items-center justify-center w-8 h-8 rounded-lg text-[#9CAEA2] hover:text-[#F2F5F2] hover:bg-[#14251C] cursor-pointer"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Sections Area with smooth scroll */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3 scrollbar-thin scrollbar-thumb-emerald-950">
        {NAV_SECTIONS.map((section, sIdx) => (
          <div key={section.category} className="space-y-1">
            {/* Section Header or Divider */}
            {sIdx > 0 && (
              <AnimatePresence mode="wait">
                {isExpanded ? (
                  <motion.div
                    key="header-text"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={animationTransition}
                    className="px-3 pt-2.5 pb-1 text-[11px] font-semibold tracking-wider text-emerald-400/80 uppercase select-none overflow-hidden"
                  >
                    {section.category}
                  </motion.div>
                ) : (
                  <motion.div
                    key="divider-line"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={animationTransition}
                    className="h-px bg-emerald-950/60 my-2 mx-2"
                  />
                )}
              </AnimatePresence>
            )}

            {/* Navigation Items in Section */}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.path === '/dashboard'
                  ? location.pathname === '/dashboard'
                  : location.pathname.startsWith(item.path);

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={!isExpanded ? item.title : undefined}
                  className={`group relative rounded-xl text-[16px] font-medium transition-all duration-200 cursor-pointer flex items-center ${
                    isExpanded
                      ? 'gap-3 px-3 py-2 w-full justify-start'
                      : 'w-11 h-11 mx-auto justify-center p-0'
                  } ${
                    isActive
                      ? 'bg-gradient-to-r from-[#174C34]/90 to-[#103323]/60 text-emerald-200 border border-emerald-600/70 shadow-[0_2px_12px_rgba(23,76,52,0.35)]'
                      : 'text-[#9CAEA2] hover:text-[#F2F5F2] hover:bg-[#12241C] border border-transparent'
                  }`}
                >
                  {/* Left emerald active indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebarActivePill"
                      className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                      transition={animationTransition}
                    />
                  )}

                  {/* Icon container */}
                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    <Icon
                      className={`w-5 h-5 transition-transform duration-200 group-hover:scale-105 ${
                        isActive ? 'text-emerald-400' : 'text-[#9CAEA2] group-hover:text-emerald-300'
                      }`}
                    />
                  </div>

                  {/* Animated Navigation Label */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, x: -6, width: 0 }}
                        animate={{ opacity: 1, x: 0, width: 'auto' }}
                        exit={{ opacity: 0, x: -6, width: 0 }}
                        transition={animationTransition}
                        className="flex-1 flex items-center justify-between min-w-0 overflow-hidden whitespace-nowrap pl-0.5"
                      >
                        <span className="truncate leading-none">{item.title}</span>

                        {item.badge && (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 shadow-sm shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Accessible Tooltip in collapsed mode */}
                  {!isExpanded && (
                    <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#0D1914] text-[#F2F5F2] text-[13px] font-medium rounded-lg shadow-2xl border border-emerald-800/80 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                      {item.title}
                      {item.badge && (
                        <span className="ml-1.5 text-[11px] text-emerald-400">
                          ({item.badge})
                        </span>
                      )}
                    </div>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer / Profile Section fixed at bottom */}
      <div className="p-3 border-t border-emerald-950/80 relative shrink-0 mt-auto">
        <div
          onClick={() => setShowProfileMenu((prev) => !prev)}
          className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer hover:bg-[#14251C] transition-all duration-200 border border-transparent hover:border-emerald-900/60 ${
            showProfileMenu ? 'bg-[#14251C] border-emerald-900/60' : ''
          } ${!isExpanded ? 'justify-center p-1.5' : ''}`}
          role="button"
          tabIndex={0}
          title={!isExpanded ? `${user.name} (${user.organization || 'JSPM JSCOE, PUNE'})` : undefined}
          aria-label="User profile settings and sign out"
        >
          {/* Avatar initials */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#174C34] to-[#102B1F] text-emerald-300 font-bold flex items-center justify-center text-xs shrink-0 border border-emerald-600/60 shadow-sm">
            {user.avatarInitials || 'AC'}
          </div>

          {/* User details animated in expanded mode */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, x: -6, width: 0 }}
                animate={{ opacity: 1, x: 0, width: 'auto' }}
                exit={{ opacity: 0, x: -6, width: 0 }}
                transition={animationTransition}
                className="min-w-0 flex-1 flex items-center justify-between gap-1.5 overflow-hidden whitespace-nowrap"
              >
                <div className="truncate text-left">
                  <div className="text-[15px] font-semibold text-[#F2F5F2] truncate">
                    {user.name || 'Aashish Chitale'}
                  </div>
                  <div className="text-[11px] text-[#9CAEA2] truncate">
                    {user.organization || user.email || 'Analyst'}
                  </div>
                </div>

                <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 truncate max-w-[90px]">
                  {user.role ? user.role.toUpperCase() : 'USER'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Quick Sign Out row */}
        <div className="mt-1">
          <button
            type="button"
            onClick={onLogout}
            title={!isExpanded ? 'Sign Out' : undefined}
            className={`w-full flex items-center rounded-xl text-[15px] font-medium text-[#9CAEA2] hover:text-red-300 hover:bg-red-950/30 transition-all duration-200 cursor-pointer ${
              isExpanded ? 'gap-2.5 px-2 py-1.5' : 'justify-center p-2'
            }`}
          >
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
              <LogOut className="w-4 h-4 text-[#9CAEA2] hover:text-red-400 transition-colors" />
            </div>
            <AnimatePresence>
              {isExpanded && (
                <motion.span
                  initial={{ opacity: 0, x: -6, width: 0 }}
                  animate={{ opacity: 1, x: 0, width: 'auto' }}
                  exit={{ opacity: 0, x: -6, width: 0 }}
                  transition={animationTransition}
                  className="overflow-hidden whitespace-nowrap"
                >
                  Sign Out
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* Profile Dropdown Popover */}
        {showProfileMenu && (
          <div
            className={`absolute bottom-full mb-2 ${
              isExpanded ? 'left-3 right-3' : 'left-full ml-3 w-56'
            } bg-[#0D1914] border border-emerald-900/80 rounded-xl shadow-2xl p-2.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-150`}
          >
            <div className="px-2 py-1.5 border-b border-emerald-950/80 mb-1.5">
              <p className="font-semibold text-[#F2F5F2] truncate text-[14px]">{user.name}</p>
              <p className="text-[11px] text-[#9CAEA2] truncate">{user.email}</p>
              <p className="text-[10px] font-mono text-emerald-400 mt-0.5 truncate">
                {user.organization || 'JSPM JSCOE, PUNE'}
              </p>
            </div>

            <NavLink
              to="/dashboard/settings"
              onClick={() => setShowProfileMenu(false)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[#9CAEA2] hover:text-[#F2F5F2] hover:bg-[#14251C] transition-colors"
            >
              <Settings className="w-4 h-4 text-emerald-400" />
              <span className="text-[13px]">Preferences & Settings</span>
            </NavLink>

            <button
              type="button"
              onClick={() => {
                setShowProfileMenu(false);
                onLogout();
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 mt-1 rounded-lg text-red-300 hover:text-red-200 hover:bg-red-950/40 text-left transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-red-400" />
              <span className="text-[13px]">Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar with Framer Motion animated width */}
      <motion.aside
        animate={{ width: isDesktopExpanded ? 260 : 76 }}
        transition={animationTransition}
        onMouseEnter={() => {
          if (collapsed) setIsHovered(true);
        }}
        onMouseLeave={() => {
          if (collapsed) setIsHovered(false);
        }}
        className="hidden md:block shrink-0 relative z-30 select-none"
      >
        <motion.div
          animate={{ width: isDesktopExpanded ? 260 : 76 }}
          transition={animationTransition}
          className="fixed top-0 bottom-0 left-0 h-screen z-30 overflow-hidden"
        >
          {renderSidebarContent(isDesktopExpanded)}
        </motion.div>
      </motion.aside>

      {/* Mobile Drawer with Backdrop and Framer Motion slide-in */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={animationTransition}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 md:hidden"
              onClick={onCloseMobile}
              aria-hidden="true"
            />
            <motion.aside
              key="mobile-drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={animationTransition}
              className="fixed top-0 bottom-0 left-0 w-[260px] max-w-[85vw] z-50 md:hidden bg-[#0D1914] border-r border-emerald-950 shadow-2xl overflow-hidden"
            >
              {renderSidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default DashboardSidebar;
