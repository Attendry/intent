"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, UserPlus, Building2, FileText,
  BarChart3, Settings, Sparkles, Briefcase, Target,
  Menu, X, Bookmark, Columns3, Share2,
} from "lucide-react";


export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [badges, setBadges] = useState<{ queueTotal: number; scheduledPostsDue: number }>({
    queueTotal: 0,
    scheduledPostsDue: 0,
  });

  useEffect(() => {
    fetch("/api/reminders/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setBadges({ queueTotal: d.queueTotal ?? 0, scheduledPostsDue: d.scheduledPostsDue ?? 0 });
      })
      .catch(() => {});
  }, []);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar text-sidebar-foreground md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`group fixed left-0 top-0 z-40 flex h-screen w-52 flex-col bg-sidebar transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0 md:w-[60px] md:hover:w-52`}>
        <div className="flex h-16 items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary shadow-soft">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="overflow-hidden whitespace-nowrap text-base font-bold tracking-tight text-sidebar-foreground md:opacity-0 md:transition-opacity md:duration-300 md:group-hover:opacity-100">
              Twobrains
            </span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="text-sidebar-foreground md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-2.5 pt-2">
          {[
            { href: "/", label: "Home", icon: LayoutDashboard, badge: badges.queueTotal },
            { href: "/pipeline", label: "Pipeline", icon: Columns3 },
            { href: "/companies", label: "Companies", icon: Building2 },
            { href: "/prospects", label: "Prospects", icon: Users },
            { href: "/suggestions", label: "Suggestions", icon: UserPlus },
          ].map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const badge: number = "badge" in item ? ((item as { badge?: number }).badge ?? 0) : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                onClick={() => setMobileOpen(false)}
                className={`group/item relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-white/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                    : "text-sidebar-foreground/60 hover:bg-white/8 hover:text-sidebar-foreground"
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full gradient-primary" />
                )}
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span className="overflow-hidden whitespace-nowrap md:opacity-0 md:transition-opacity md:duration-300 md:group-hover:opacity-100">
                  {item.label}
                </span>
                {badge > 0 && (
                  <span className="ml-auto rounded-full bg-white/20 px-1.5 py-0.5 text-xs font-semibold" aria-live="polite">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
          <div className="my-2 h-px bg-white/10" />
          {[
            { href: "/content", label: "Content", icon: FileText },
            { href: "/social-posts", label: "Social Posts", icon: Share2, badge: badges.scheduledPostsDue },
            { href: "/findings", label: "Findings", icon: Bookmark },
            { href: "/fit-overview", label: "Fit Overview", icon: Target },
            { href: "/my-company", label: "My Company", icon: Briefcase },
            { href: "/review", label: "Weekly Review", icon: BarChart3 },
          ].map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const badge: number = "badge" in item ? ((item as { badge?: number }).badge ?? 0) : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                onClick={() => setMobileOpen(false)}
                className={`group/item relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-white/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                    : "text-sidebar-foreground/60 hover:bg-white/8 hover:text-sidebar-foreground"
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full gradient-primary" />
                )}
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span className="overflow-hidden whitespace-nowrap md:opacity-0 md:transition-opacity md:duration-300 md:group-hover:opacity-100">
                  {item.label}
                </span>
                {badge > 0 && (
                  <span className="ml-auto rounded-full bg-white/20 px-1.5 py-0.5 text-xs font-semibold" aria-live="polite">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="my-2 h-px bg-white/10" />
        {[
          { href: "/settings", label: "Settings", icon: Settings },
        ].map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              onClick={() => setMobileOpen(false)}
              className={`group/item relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-white/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                  : "text-sidebar-foreground/60 hover:bg-white/8 hover:text-sidebar-foreground"
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full gradient-primary" />
              )}
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              <span className="overflow-hidden whitespace-nowrap md:opacity-0 md:transition-opacity md:duration-300 md:group-hover:opacity-100">
                {item.label}
              </span>
            </Link>
          );
        })}
      </aside>
    </>
  );
}
