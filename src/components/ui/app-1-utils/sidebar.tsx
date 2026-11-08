"use client";

import React, { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";
import { PanelLeft } from "lucide-react";

interface SidebarContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useAppSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useAppSidebar must be used within SidebarProvider");
  return ctx;
}

export function SidebarProvider({
  children,
  defaultOpen = true,
  className,
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toggleSidebar = () => setOpen((prev) => !prev);

  return (
    <SidebarContext.Provider value={{ open, setOpen, toggleSidebar }}>
      <div className={cn("flex min-h-screen w-full bg-[#0B1713] text-[#F2F5F2]", className)}>
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function SidebarInset({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-1 flex-col min-w-0 bg-[#0B1713]", className)}>
      {children}
    </div>
  );
}

export function SidebarTrigger({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { toggleSidebar } = useAppSidebar();
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-2 text-[#9CAEA2] hover:bg-[#101F18] hover:text-[#F2F5F2] focus:outline-none transition-colors",
        className
      )}
      {...props}
    >
      <PanelLeft className="w-5 h-5" />
    </button>
  );
}

