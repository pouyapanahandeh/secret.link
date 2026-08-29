interface FilterTabsProps {
  tabs: { id: string; label: string; count?: number }[];
  activeId: string;
  onChange: (id: string) => void;
}

export function FilterTabs({ tabs, activeId, onChange }: FilterTabsProps) {
  return (
    <div className="mb-6 -mx-1 overflow-x-auto px-1 pb-1">
      <div className="inline-flex min-w-full gap-1 rounded-full border border-border bg-surface-raised p-1 sm:min-w-0">
        {tabs.map((tab) => {
          const active = activeId === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                active ? "bg-accent text-black" : "text-text-muted hover:text-text"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${
                    active ? "bg-black/15 text-black" : "bg-surface text-text-muted"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
