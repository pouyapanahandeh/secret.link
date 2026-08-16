import { useEffect } from "react";
import type { PlaceGroup } from "@secretlink/core";

interface PlaceTagActionSheetProps {
  group: PlaceGroup;
  onViewStories: () => void;
  onShowOnMap: () => void;
  onClose: () => void;
}

export function PlaceTagActionSheet({
  group,
  onViewStories,
  onShowOnMap,
  onClose,
}: PlaceTagActionSheetProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-[9000] bg-black/50" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-label={`${group.label} · ${group.count} stories`}
        className="fixed z-[9001] left-1/2 -translate-x-1/2 bottom-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 w-full sm:w-80 max-w-md bg-surface border border-border/50 rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-border/50">
          <div>
            <p className="text-sm font-bold">{group.label}</p>
            <p className="text-xs text-text-muted">{group.count} stories</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text text-xl leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="py-1">
          <button
            type="button"
            onClick={onViewStories}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-surface-raised transition-colors"
          >
            <span className="text-lg leading-none">📖</span>
            <span>View stories</span>
          </button>
          <button
            type="button"
            onClick={onShowOnMap}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-surface-raised transition-colors"
          >
            <span className="text-lg leading-none">📍</span>
            <span>Show on map</span>
          </button>
        </div>

        <div className="px-4 pb-4 pt-1 sm:hidden">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full border border-border py-2.5 text-sm text-text-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
