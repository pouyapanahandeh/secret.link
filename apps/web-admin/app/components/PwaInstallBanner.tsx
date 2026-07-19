import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) return;
    if (sessionStorage.getItem("admin-pwa-dismissed")) return;

    const ua = window.navigator.userAgent;
    const isiOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isInStandalone = window.matchMedia("(display-mode: standalone)").matches;

    if (isiOS && !isInStandalone) {
      setIsIos(true);
      setShow(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShow(false);
    }
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    setShow(false);
    setDismissed(true);
    sessionStorage.setItem("admin-pwa-dismissed", "1");
  }

  if (!show || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:bottom-6">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 shadow-xl">
        <img src="/icon-192.png" alt="Secretlink Admin" className="h-10 w-10 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text)]">Install Secretlink Admin</p>
          {isIos ? (
            <p className="text-xs text-[var(--text-muted)]">
              Tap Share then &quot;Add to Home Screen&quot;
            </p>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">
              Add to home screen for quick moderation access
            </p>
          )}
        </div>
        {!isIos && (
          <button
            type="button"
            onClick={handleInstall}
            className="btn btn-primary shrink-0 px-4 py-2 text-xs"
          >
            Install
          </button>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 p-1 text-[var(--text-muted)] hover:text-[var(--text)]"
          aria-label="Dismiss"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
