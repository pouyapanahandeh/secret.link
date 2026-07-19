import { useEffect } from "react";
import { mapTimeRemaining } from "@secretlink/core";
import type { PlaceGroup } from "@secretlink/core";
import type { MapSecret } from "../lib/map-types";

interface StoryGroupSheetProps {
  group: PlaceGroup;
  onClose: () => void;
  onSelectStory: (secret: MapSecret) => void;
  secretsById: Map<string, MapSecret>;
}

export function StoryGroupSheet({ group, onClose, onSelectStory, secretsById }: StoryGroupSheetProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-[8000] bg-black/40" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-label={`Stories in ${group.label}`}
        className="fixed z-[8001] left-1/2 -translate-x-1/2 bottom-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 w-full sm:max-w-md max-h-[70vh] bg-surface border border-border/50 rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col"
      >
        <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-semibold">{group.label}</h3>
            <p className="text-xs text-text-muted">{group.count} stories</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text text-lg" aria-label="Close">×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-3 space-y-2">
          {group.stories.map((meta) => {
            const s = secretsById.get(meta.id);
            if (!s) return null;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectStory(s)}
                className="w-full flex items-center gap-3 bg-surface-raised rounded-xl border border-border p-3 hover:border-accent/50 transition-colors text-left"
              >
                <span className="text-lg">{s.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-muted italic">Tap to reveal</p>
                  <p className="text-xs text-text-muted truncate">
                    {s.handle ? `@${s.handle} · ` : ""}
                    {(s.cityName || s.locationName) ? `${s.cityName || s.locationName} · ` : ""}
                    {mapTimeRemaining(s.expiresAt)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
