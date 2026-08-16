import type { PlaceGroup } from "@secretlink/core";

interface PlaceTagBarProps {
  groupedPlaces: PlaceGroup[];
  selectedPlaceKey: string | null;
  onSelect: (key: string) => void;
}

export function PlaceTagBar({ groupedPlaces, selectedPlaceKey, onSelect }: PlaceTagBarProps) {
  if (groupedPlaces.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
      {groupedPlaces.map((g) => (
        <button
          key={g.key}
          type="button"
          aria-pressed={selectedPlaceKey === g.key}
          onClick={() => onSelect(g.key)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border shadow-md transition-colors backdrop-blur-sm ${
            selectedPlaceKey === g.key
              ? "bg-accent border-accent text-black"
              : "bg-surface-raised/95 border-border text-text-muted hover:border-accent/40"
          }`}
        >
          {g.label} · {g.count}
        </button>
      ))}
    </div>
  );
}
