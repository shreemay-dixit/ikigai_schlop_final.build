"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Calendar, Users, Settings, FileText, Shield, Search,
  Bell, Menu, X, ChevronRight, LogOut, HeartPulse, Activity, ListOrdered, PieChart, Building2
} from "lucide-react";

const NAV = [
  { name: "Live Queue", href: "/dashboard", icon: ListOrdered },
  { name: "Dashboard", href: "/dashboard/analytics", icon: PieChart },
  { name: "Appointments", href: "/dashboard/appointments", icon: Calendar },
  { name: "Recovery Waves", href: "/dashboard/recovery", icon: Activity },
  { name: "Audit Log", href: "/dashboard/audit", icon: FileText },
  { name: "Configuration", href: "/dashboard/organization", icon: Building2 },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname?.startsWith(href);

  const label = () => {
    const match = NAV.find((n) => isActive(n.href));
    return match?.name ?? "Dashboard";
  };

  return (
    <div className="flex min-h-screen bg-stone-50">
      {/* ─── Sidebar ─── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-stone-900 transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 border-b border-stone-800 px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500 text-white shadow-sm">
            <HeartPulse className="h-4 w-4" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">Fillwell</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-stone-500">Platform</p>
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  active
                    ? "bg-rose-500/10 text-rose-400"
                    : "text-stone-400 hover:bg-stone-800 hover:text-stone-200"
                }`}
              >
                <item.icon className={`h-4 w-4 ${active ? "text-rose-400" : "text-stone-500"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-stone-800 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-stone-800/50 p-3 transition hover:bg-stone-800 cursor-pointer">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-purple-500 text-xs font-bold text-white shadow-inner">
              SL
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">Dr. Sarah Lin</p>
              <p className="truncate text-xs text-stone-400">Admin</p>
            </div>
            <Link href="/login" className="rounded-md p-1.5 text-stone-400 transition-colors hover:text-red-400">
              <LogOut className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </aside>

      {/* ─── Main Column ─── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-stone-200 bg-white/80 backdrop-blur-md px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(!open)} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 md:hidden">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="hidden items-center gap-1.5 text-sm text-stone-500 md:flex">
              <span>Dashboard</span>
              <ChevronRight className="h-3.5 w-3.5 text-stone-300" />
              <span className="font-semibold text-stone-900">{label()}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search…"
                className="w-56 rounded-lg border-0 bg-stone-100 py-1.5 pl-8 pr-3 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus:bg-white focus:ring-2 focus:ring-rose-200"
              />
            </div>
            <button className="relative rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="animate-page-in">{children}</div>
        </main>
      </div>

      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 z-30 bg-stone-900/40 md:hidden" onClick={() => setOpen(false)} />}
    </div>
  );
}
