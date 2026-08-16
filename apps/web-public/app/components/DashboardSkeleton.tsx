import type { ReactNode } from "react";
import { UI_FEATURES } from "../lib/feature-flags";

export type DashboardTab = "inbox" | "map" | "profile";

function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-surface-raised ${className}`} />;
}

function NavIconSkeleton() {
  return <Pulse className="w-5 h-5 rounded-lg" />;
}

function DashboardShell({
  children,
  activeTab,
}: {
  children: ReactNode;
  activeTab?: DashboardTab;
}) {
  const navCount = UI_FEATURES.messages ? 4 : 3;
  const navItems: { id: DashboardTab | "messages"; label: string }[] = [
    { id: "inbox", label: "Home" },
    { id: "map", label: "Map" },
    ...(UI_FEATURES.messages ? [{ id: "messages" as const, label: "Messages" }] : []),
    { id: "profile", label: "Profile" },
  ];

  return (
    <main className="h-screen flex flex-col sm:flex-row bg-surface">
      <aside className="hidden sm:flex flex-col w-56 lg:w-64 border-r border-border bg-surface shrink-0">
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Pulse className="w-8 h-8 rounded-lg" />
            <Pulse className="h-4 w-32" />
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-full ${
                activeTab === item.id ? "bg-accent/20" : ""
              }`}
            >
              <NavIconSkeleton />
              <Pulse className={`h-4 ${activeTab === item.id ? "w-16 bg-accent/20" : "w-20"}`} />
            </div>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-border">
          <div className="flex items-center justify-between px-3">
            <Pulse className="w-8 h-8 rounded-full" />
            <Pulse className="w-8 h-8 rounded-full" />
            <Pulse className="h-3 w-12" />
          </div>
        </div>
      </aside>

      <header className="sm:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-surface shrink-0">
        <Pulse className="w-7 h-7 rounded-lg" />
        <div className="flex items-center gap-2">
          <Pulse className="w-8 h-8 rounded-full" />
          <Pulse className="w-8 h-8 rounded-full" />
          <Pulse className="h-3 w-12" />
        </div>
      </header>

      {children}

      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-xl border-t border-border z-30">
        <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
          {Array.from({ length: navCount }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1 px-3 py-1.5">
              <NavIconSkeleton />
              <Pulse className="h-2 w-8" />
            </div>
          ))}
        </div>
      </nav>
    </main>
  );
}

export function InboxContentSkeleton() {
  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <Pulse className="w-12 h-12 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Pulse className="h-4 w-32" />
          <Pulse className="h-3 w-48" />
        </div>
        <Pulse className="h-7 w-14 rounded-full shrink-0" />
      </div>

      <Pulse className="h-11 w-full mb-6" />

      <div className="flex gap-3 mb-6 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 shrink-0">
            <Pulse className="w-14 h-14 rounded-full" />
            <Pulse className="h-2 w-10" />
          </div>
        ))}
      </div>

      <Pulse className="h-11 w-full mb-6" />

      <Pulse className="h-4 w-20 mb-3" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Pulse key={i} className="h-16 w-full" />
        ))}
      </div>

      <Pulse className="h-4 w-16 mt-8 mb-3" />
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Pulse key={i} className="h-16 w-full" />
        ))}
      </div>
    </>
  );
}

export function MapContentSkeleton() {
  return (
    <>
      <Pulse className="h-6 w-36 mb-2" />
      <Pulse className="h-3 w-56 mb-4" />

      <div className="mb-4 flex items-center gap-2 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Pulse key={i} className="h-8 w-24 rounded-full shrink-0" />
        ))}
      </div>

      <div className="relative border border-border overflow-hidden mb-6" style={{ height: "400px" }}>
        <Pulse className="absolute inset-0 rounded-none" />
        <div className="absolute bottom-4 right-4">
          <Pulse className="w-10 h-10 rounded-full" />
        </div>
      </div>

      <Pulse className="h-4 w-28 mb-3" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Pulse key={i} className="h-16 w-full" />
        ))}
      </div>
    </>
  );
}

export function DashboardProfileTabSkeleton() {
  return (
    <>
      <div className="text-center mb-6">
        <Pulse className="w-16 h-16 rounded-full mx-auto mb-3" />
        <Pulse className="h-5 w-32 mx-auto mb-2" />
        <Pulse className="h-3 w-40 mx-auto" />
        <div className="flex items-center justify-center gap-4 mt-3">
          <Pulse className="h-3 w-20" />
          <Pulse className="h-3 w-20" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <Pulse className="h-12 w-full" />
        <Pulse className="h-12 w-full" />
      </div>

      <div className="border border-border p-4 sm:p-6 space-y-5">
        <div className="space-y-2">
          <Pulse className="h-3 w-8" />
          <Pulse className="h-4 w-full" />
          <Pulse className="h-4 w-3/4" />
        </div>
        <div className="space-y-2">
          <Pulse className="h-3 w-20" />
          <div className="flex gap-2">
            <Pulse className="h-8 w-24 rounded-full" />
            <Pulse className="h-8 w-24 rounded-full" />
          </div>
        </div>
        <Pulse className="h-11 w-full" />
      </div>
    </>
  );
}

export function ProfileViewContentSkeleton() {
  return (
    <>
      <div className="flex gap-4 items-start mb-6">
        <Pulse className="w-16 h-16 sm:w-20 sm:h-20 rounded-full shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <Pulse className="h-6 w-36" />
          <div className="flex gap-4 mt-1">
            <Pulse className="h-3 w-20" />
            <Pulse className="h-3 w-20" />
          </div>
          <Pulse className="h-4 w-full" />
          <Pulse className="h-4 w-2/3" />
          <div className="flex gap-2 pt-1">
            <Pulse className="h-8 w-24 rounded-full" />
            <Pulse className="h-8 w-24 rounded-full" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Pulse className="h-9 w-28 rounded-full" />
        <Pulse className="h-9 w-24 rounded-full" />
        <Pulse className="h-9 w-32 rounded-full" />
      </div>

      <div className="border border-border p-4 space-y-3">
        <Pulse className="h-4 w-32" />
        <Pulse className="h-24 w-full" />
        <Pulse className="h-11 w-full rounded-full" />
      </div>
    </>
  );
}

export function DashboardSkeleton({ tab = "inbox" }: { tab?: DashboardTab }) {
  return (
    <DashboardShell activeTab={tab}>
      <div className="flex-1 overflow-y-auto pb-20 sm:pb-6">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          {tab === "inbox" && <InboxContentSkeleton />}
          {tab === "map" && <MapContentSkeleton />}
          {tab === "profile" && <DashboardProfileTabSkeleton />}
        </div>
      </div>
    </DashboardShell>
  );
}

export function ProfilePageSkeleton() {
  return (
    <DashboardShell activeTab="profile">
      <div className="flex-1 overflow-y-auto pb-20 sm:pb-8">
        <div className="max-w-lg mx-auto px-4 pt-8">
          <ProfileViewContentSkeleton />
        </div>
      </div>
    </DashboardShell>
  );
}

export function readDashboardTabFromHash(): DashboardTab {
  if (typeof window === "undefined") return "inbox";
  const hash = window.location.hash.replace("#", "");
  if (hash === "map") return "map";
  if (hash === "profile") return "profile";
  return "inbox";
}
