interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
}

const btnClass =
  "w-10 h-10 flex items-center justify-center bg-surface-raised/95 backdrop-blur-sm border border-border text-text hover:border-accent/50 hover:text-accent transition-colors pointer-events-auto";

export function MapControls({ onZoomIn, onZoomOut, onLocate }: MapControlsProps) {
  return (
    <>
      {/* Zoom — desktop only; mobile uses pinch/scroll */}
      <div className="absolute top-3 left-3 z-[1000] hidden sm:flex flex-col rounded-xl overflow-hidden shadow-lg border border-border pointer-events-auto">
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
        <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.364-6.364l-1.414 1.414M7.05 16.95l-1.414 1.414m12.728 0l-1.414-1.414M7.05 7.05L5.636 5.636M12 8a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
      </button>
    </>
  );
}
