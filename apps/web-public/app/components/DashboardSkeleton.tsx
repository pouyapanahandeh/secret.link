import { UI_FEATURES } from "../lib/feature-flags";

function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-surface-raised ${className}`} />;
}

function NavIconSkeleton() {
  return <Pulse className="w-5 h-5 rounded-lg" />;
}

export function DashboardSkeleton() {
  const navCount = UI_FEATURES.messages ? 4 : 3;

  return (
    <main className="h-screen flex flex-col sm:flex-row bg-surface">
      {/* Desktop sidebar */}
      <aside className="hidden sm:flex flex-col w-56 lg:w-64 border-r border-border/50 bg-surface shrink-0">
        <div className="px-5 py-5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Pulse className="w-7 h-7 rounded-lg" />
            <Pulse className="h-5 w-36" />
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {Array.from({ length: navCount }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <NavIconSkeleton />
              <Pulse className="h-4 w-20" />
            </div>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-border/50">
          <div className="flex items-center justify-between px-3">
            <Pulse className="w-8 h-8 rounded-full" />
            <Pulse className="w-8 h-8 rounded-full" />
            <Pulse className="h-3 w-12" />
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sm:hidden flex items-center justify-between px-4 py-3 border-b border-border/50 bg-surface shrink-0">
        <Pulse className="w-6 h-6 rounded-lg" />
        <div className="flex items-center gap-2">
          <Pulse className="w-8 h-8 rounded-full" />
          <Pulse className="w-8 h-8 rounded-full" />
          <Pulse className="h-3 w-12" />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20 sm:pb-6">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          {/* Profile summary */}
          <div className="flex items-center gap-3 mb-6">
            <Pulse className="w-12 h-12 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Pulse className="h-4 w-32" />
              <Pulse className="h-3 w-48" />
            </div>
            <Pulse className="h-7 w-14 rounded-full shrink-0" />
          </div>

          {/* Profile link bar */}
          <Pulse className="h-11 w-full mb-6" />

          {/* Stories row */}
          <div className="flex gap-3 mb-6 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 shrink-0">
                <Pulse className="w-14 h-14 rounded-full" />
                <Pulse className="h-2 w-10" />
              </div>
            ))}
          </div>

          {/* Search */}
          <Pulse className="h-11 w-full mb-6" />

          {/* Inbox section */}
          <Pulse className="h-4 w-20 mb-3" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Pulse key={i} className="h-16 w-full" />
            ))}
          </div>

          {/* Sent section */}
          <Pulse className="h-4 w-16 mt-8 mb-3" />
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Pulse key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border/50 z-30">
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
