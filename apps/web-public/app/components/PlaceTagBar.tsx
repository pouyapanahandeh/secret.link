import type { PlaceGroup } from "@secretlink/core";

interface PlaceTagBarProps {
  groupedPlaces: PlaceGroup[];
  selectedPlaceKey: string | null;
  onSelect: (key: string | null) => void;
}

export function PlaceTagBar({ groupedPlaces, selectedPlaceKey, onSelect }: PlaceTagBarProps) {
  if (groupedPlaces.length === 0) return null;

  return (
    <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        aria-pressed={selectedPlaceKey === null}
        onClick={() => onSelect(null)}
        className={`shrink-0 rounded-full px-3 py-1.5 text-xs border transition-colors ${
          selectedPlaceKey === null ? "bg-accent/20 border-accent text-accent" : "bg-surface border-border text-text-muted"
        }`}
      >
        All
      </button>
      {groupedPlaces.map((g) => (
        <button
          key={g.key}
          type="button"
          aria-pressed={selectedPlaceKey === g.key}
          onClick={() => onSelect(g.key)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs border transition-colors ${
            selectedPlaceKey === g.key ? "bg-accent/20 border-accent text-accent" : "bg-surface border-border text-text-muted hover:border-accent/40"
          }`}
        >
          {g.label} · {g.count}
        </button>
      ))}
    </div>
  );
}
