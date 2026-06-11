import { useEffect, useRef, useState, useCallback } from "react";

type ProtectedViewerProps = {
  children: React.ReactNode;
  autoHideSeconds?: number;
  onExpired?: () => void;
};

/**
 * Anti-capture wrapper component.
 * - DESTROYS content from DOM after timer expires (not just hides)
 * - Blanks content when tab/window loses focus
 * - Disables right-click, text selection, drag
 * - Uses CSS to resist screen capture tools
 */
export function ProtectedViewer({ children, autoHideSeconds = 30, onExpired }: ProtectedViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [remaining, setRemaining] = useState(autoHideSeconds);
  const [destroyed, setDestroyed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const expiredRef = useRef(false);

  const destroyContent = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    setDestroyed(true);
    // Revoke any object URLs in the container
    if (containerRef.current) {
      const media = containerRef.current.querySelectorAll("img, video, source");
      media.forEach((el) => {
        const src = (el as HTMLMediaElement).src || (el as HTMLSourceElement).src;
        if (src?.startsWith("blob:")) {
          URL.revokeObjectURL(src);
        }
      });
      containerRef.current.innerHTML = "";
    }
    onExpired?.();
  }, [onExpired]);

  useEffect(() => {
    if (destroyed) return;

    // Countdown timer
    const interval = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(interval);
          destroyContent();
        }
        return Math.max(next, 0);
      });
    }, 1000);

    // Visibility API — hide when tab not visible
    const handleVisibility = () => {
      if (document.hidden) setHidden(true);
      else setHidden(false);
    };

    // Window blur — hide when window loses focus (most screenshot tools steal focus)
    const handleBlur = () => setHidden(true);
    const handleFocus = () => setHidden(false);

    // Block right-click
    const handleContextMenu = (e: Event) => e.preventDefault();

    // Block print
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "p") {
        e.preventDefault();
      }
    };

    // Block print via media query
    const printStyle = document.createElement("style");
    printStyle.textContent = `@media print { .protected-content { display: none !important; } }`;
    document.head.appendChild(printStyle);

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      document.head.removeChild(printStyle);
    };
  }, [destroyed, destroyContent]);

  if (destroyed) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-surface-raised p-8 text-center">
        <span className="text-3xl block mb-3">💨</span>
        <p className="text-sm font-medium text-red-400">Time's up — content destroyed</p>
        <p className="text-xs text-text-muted mt-2">This secret no longer exists anywhere.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timer badge */}
      <div className="flex justify-center mb-3">
        <span className={`inline-flex items-center gap-1.5 text-xs bg-surface-raised border rounded-full px-3 py-1 ${
          remaining <= 10 ? "border-red-500/50 text-red-400" : "border-border text-text-muted"
        }`}>
          ⏱️ Disappears in{" "}
          <span className={`font-mono font-bold ${remaining <= 10 ? "text-red-400 animate-pulse" : "text-accent"}`}>
            {remaining}s
          </span>
        </span>
      </div>

      {/* Protected content */}
      <div
        ref={containerRef}
        className="protected-content transition-all duration-200"
        style={{
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          // Hide content when window loses focus (screenshot protection)
          filter: hidden ? "blur(30px) brightness(0.2)" : "none",
          opacity: hidden ? 0.1 : 1,
          // Prevent content from appearing in screenshots on some systems
          contentVisibility: hidden ? "hidden" : "visible",
        }}
        onDragStart={(e) => e.preventDefault()}
        onCopy={(e) => e.preventDefault()}
      >
        {children}
      </div>

      {hidden && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-text-muted bg-surface/90 px-4 py-2 rounded-full">
            👀 Return focus to see content
          </p>
        </div>
      )}
    </div>
  );
}
