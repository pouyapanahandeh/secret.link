import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const TOAST_MS = 2200;

export function useFlashToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(text);
    timerRef.current = setTimeout(() => setMessage(null), TOAST_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { message, show };
}

export function Toast({ message }: { message: string | null }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !message) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="toast-copy pointer-events-none fixed left-1/2 bottom-24 sm:bottom-8 z-[250] flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-black shadow-lg shadow-black/30"
    >
      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
      <span className="text-xs font-extrabold tracking-tight">{message}</span>
    </div>,
    document.body,
  );
}
