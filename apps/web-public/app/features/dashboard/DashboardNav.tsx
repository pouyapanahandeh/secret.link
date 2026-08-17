import { useEffect, useRef, useState } from "react";
import { Link } from "@remix-run/react";
import { Avatar } from "../../components/Avatar";
import { ThemeToggle } from "../../components/ThemeToggle";
import { NotificationBell } from "../../components/NotificationBell";
import { UI_FEATURES } from "../../lib/feature-flags";
import type { DashboardNavProps, DashboardTab } from "./types";

function AccountMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full flex items-center justify-center border border-border text-text-muted hover:text-text hover:border-accent/50 transition-colors"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="6" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="18" r="1.6" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-52 border border-border bg-surface shadow-xl">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-border">
            <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-text-muted">Theme</span>
            <ThemeToggle />
          </div>
          <form method="post" action="/logout">
            <button
              type="submit"
              className="w-full text-left px-3 py-3 font-mono text-[10px] tracking-[0.16em] uppercase text-text-muted hover:text-accent hover:bg-surface-raised transition-colors"
            >
              Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function navIcon(id: DashboardTab | "messages", userHandle?: string, userAvatarUrl?: string | null) {
  if (id === "profile" && userHandle) {
    return (
      <Avatar
        handle={userHandle}
        avatarUrl={userAvatarUrl}
        sizeClass="w-5 h-5"
        textClass="text-[10px]"
        className="border-0"
      />
    );
  }

  switch (id) {
    case "inbox":
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      );
    case "map":
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503-11.307l4.994-2.497A.75.75 0 0121 4.196v13.608a.75.75 0 01-.497.708l-5.006 2.503m-6.994-3.015l-5.006 2.503A.75.75 0 013 19.804V6.196a.75.75 0 01.497-.708l5.006-2.503m6.994 3.015L9 4.485m6.497 1.53L9 8.515" />
        </svg>
      );
    case "messages":
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443h.004c2.174-.063 4.322-.258 6.426-.573 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
      );
    case "profile":
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      );
  }
}

const NAV_ITEMS: { id: DashboardTab | "messages"; label: string }[] = [
  { id: "inbox", label: "Home" },
  { id: "map", label: "Map" },
  ...(UI_FEATURES.messages ? [{ id: "messages" as const, label: "Messages" }] : []),
  { id: "profile", label: "Profile" },
];

export function DashboardSidebar({ activeTab, inboxCount, token, userHandle, userAvatarUrl, onNavClick }: DashboardNavProps) {
  return (
    <aside className="hidden sm:flex flex-col w-56 lg:w-64 border-r border-border bg-surface shrink-0">
      <div className="px-5 py-5 border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src="/secretlink.png" alt="" className="w-8 h-8" />
          <span className="text-sm font-extrabold tracking-tight">
            secretlink<span className="text-accent">.</span>life
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavClick(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-semibold transition-colors ${
              activeTab === item.id
                ? "bg-accent text-black"
                : "text-text-muted hover:text-text hover:bg-surface-raised"
            }`}
          >
            {navIcon(item.id, userHandle, userAvatarUrl)}
            <span>{item.label}</span>
            {item.id === "inbox" && inboxCount > 0 && (
              <span className={`ml-auto text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                activeTab === item.id ? "bg-black text-accent" : "bg-accent text-black"
              }`}>{inboxCount}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-border space-y-2">
        <div className="flex items-center justify-between px-3">
          <NotificationBell token={token} onNavigate={onNavClick} />
          <ThemeToggle />
          <form method="post" action="/logout">
            <button type="submit" className="font-mono text-[10px] tracking-[0.14em] uppercase text-text-muted hover:text-accent">
              Log out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

export function DashboardMobileHeader({
  token,
  onNavClick,
}: Pick<DashboardNavProps, "token" | "onNavClick">) {
  return (
    <header className="sm:hidden flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-surface shrink-0">
      <Link to="/dashboard" className="flex items-center gap-2 min-w-0">
        <img src="/secretlink.png" alt="" className="w-7 h-7 shrink-0" />
        <span className="text-sm font-extrabold tracking-tight truncate">
          secretlink<span className="text-accent">.</span>life
        </span>
      </Link>
      <div className="flex items-center gap-1 shrink-0">
        <NotificationBell token={token} onNavigate={onNavClick} />
        <AccountMenu />
      </div>
    </header>
  );
}

export function DashboardBottomNav({ activeTab, userHandle, userAvatarUrl, onNavClick }: Pick<DashboardNavProps, "activeTab" | "userHandle" | "userAvatarUrl" | "onNavClick">) {
  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-xl border-t border-border z-30 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavClick(item.id)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full transition-colors ${
              activeTab === item.id ? "text-accent" : "text-text-muted"
            }`}
          >
            {navIcon(item.id, userHandle, userAvatarUrl)}
            <span className="text-[10px] font-extrabold tracking-wide uppercase">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
