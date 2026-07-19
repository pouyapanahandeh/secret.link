interface FilterTabsProps {
  tabs: { id: string; label: string }[];
  activeId: string;
  onChange: (id: string) => void;
}

export function FilterTabs({ tabs, activeId, onChange }: FilterTabsProps) {
  return (
    <div className="mb-6 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`btn shrink-0 ${activeId === tab.id ? "btn-primary" : "btn-outline"}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
