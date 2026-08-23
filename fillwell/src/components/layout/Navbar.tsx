"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  Users,
  Search,
  Settings,
  PhoneCall,
  FlaskConical,
  Sparkles,
  Sliders,
  Key,
  CalendarCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SandboxModal } from "@/components/common/SandboxModal";
import { ApiCredentialsModal } from "@/components/settings/ApiCredentialsModal";
import { GoogleCalendarSignInModal } from "@/components/settings/GoogleCalendarSignInModal";

export function Navbar() {
  const pathname = usePathname();
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [apiKeysOpen, setApiKeysOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const navItems = [
    {
      href: "/",
      label: "Overview",
      icon: Calendar,
    },
    {
      href: "/waitlist",
      label: "Waitlist",
      icon: Users,
    },
    {
      href: "/audit",
      label: "AI Inspector",
      icon: Search,
    },
    {
      href: "/settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-stone-800/80 bg-stone-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          {/* Brand */}
          <div className="flex items-center gap-5">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-500 via-purple-500 to-cyan-400 p-[1px] shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform">
                <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-stone-950 text-white font-black text-sm">
                  F
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-stone-100 tracking-tight text-base">
                    Fillwell
                  </span>
                  <span className="text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    AI DISPATCH
                  </span>
                </div>
              </div>
            </Link>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                      isActive
                        ? "bg-purple-600/15 text-purple-300 border border-purple-500/30 shadow-sm"
                        : "text-stone-400 hover:text-stone-200 hover:bg-stone-900/60"
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", isActive ? "text-purple-400" : "text-stone-400")} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2">
            {/* Google Calendar Sign-in Quick Button */}
            <button
              onClick={() => setCalendarOpen(true)}
              title="Connect Google Calendar"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-xs font-semibold text-stone-300 transition"
            >
              <CalendarCheck className="h-3.5 w-3.5 text-rose-400" />
              <span>G-Calendar</span>
            </button>

            {/* API Keys Configuration Button */}
            <button
              onClick={() => setApiKeysOpen(true)}
              title="Configure Calling & AI API Keys (Gemini, Vapi, Twilio)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-xs font-semibold text-stone-300 transition"
            >
              <Key className="h-3.5 w-3.5 text-cyan-400" />
              <span className="hidden sm:inline">API Keys</span>
            </button>

            {/* Dedicated Client Portal Link */}
            <Link
              href="/client"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-purple-600 hover:opacity-95 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              <span>Client Link</span>
            </Link>

            {/* Behind the Scenes Sandbox Button */}
            <button
              onClick={() => setSandboxOpen(true)}
              title="Behind the Scenes Sandbox (Developer Controls)"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/30 text-purple-300 text-xs font-semibold transition"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Sandbox</span>
            </button>
          </div>
        </div>
      </header>

      {/* Sandbox Modal */}
      <SandboxModal
        isOpen={sandboxOpen}
        onClose={() => setSandboxOpen(false)}
        onRefresh={() => window.location.reload()}
      />

      {/* API Keys Credentials Modal */}
      <ApiCredentialsModal
        isOpen={apiKeysOpen}
        onClose={() => setApiKeysOpen(false)}
      />

      {/* Google Calendar Sign-In Modal */}
      <GoogleCalendarSignInModal
        isOpen={calendarOpen}
        onClose={() => setCalendarOpen(false)}
      />
    </>
  );
}
