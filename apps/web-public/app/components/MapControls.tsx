interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
}

export function LocateIcon({ className = "w-5 h-5 text-accent" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

const btnClass =
  "w-10 h-10 flex items-center justify-center bg-surface-raised/95 backdrop-blur-sm border border-border text-text hover:border-accent/50 hover:text-accent transition-colors pointer-events-auto";

export function MapControls({ onZoomIn, onZoomOut, onLocate }: MapControlsProps) {
  return (
    <>
      {/* Zoom — desktop only; mobile uses pinch/scroll */}
      <div className="absolute top-3 left-3 z-[1000] hidden sm:flex flex-col overflow-hidden shadow-lg border border-border pointer-events-auto">
        <button type="button" onClick={onZoomIn} className={`${btnClass} border-b border-border rounded-none`} aria-label="Zoom in">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
        <button type="button" onClick={onZoomOut} className={`${btnClass} rounded-none`} aria-label="Zoom out">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
          </svg>
        </button>
      </div>

      {/* Locate — bottom-left, away from the dashboard FAB */}
      <button
        type="button"
        onClick={onLocate}
        className={`absolute bottom-3 left-3 z-[1000] rounded-full shadow-lg ${btnClass}`}
        aria-label="Locate me"
      >
        <LocateIcon />
      </button>
    </>
  );
}
