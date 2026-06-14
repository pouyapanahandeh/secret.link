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
    // Don't show if already installed or previously dismissed this session
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if ((window.navigator as any).standalone === true) return; // iOS standalone
    if (sessionStorage.getItem("pwa-dismissed")) return;

    // Detect iOS
    const ua = window.navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isInStandalone = window.matchMedia("(display-mode: standalone)").matches;

    if (isiOS && !isInStandalone) {
      setIsIos(true);
      setShow(true);
      return;
    }

    // Chrome/Edge/Samsung — listen for beforeinstallprompt
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
    sessionStorage.setItem("pwa-dismissed", "1");
  }

  if (!show || dismissed) return null;

  return (
    <div className="fixed bottom-16 left-0 right-0 z-50 px-4 pb-4 sm:bottom-4">
      <div className="max-w-md mx-auto bg-surface-raised border border-border rounded-2xl p-4 shadow-xl flex items-center gap-3">
        <img src="/secretlink.png" alt="Secretlink" className="w-10 h-10 rounded-xl" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text">Install Secretlink</p>
          {isIos ? (
            <p className="text-xs text-text-muted">
              Tap <span className="inline-block align-middle">
                <svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M12 2.25v12m0-12l3 3m-3-3l-3 3" />
                </svg>
              </span> then "Add to Home Screen"
            </p>
          ) : (
            <p className="text-xs text-text-muted">Add to home screen for the best experience</p>
          )}
        </div>
        {!isIos && (
          <button
            onClick={handleInstall}
            className="shrink-0 rounded-full bg-accent px-4 py-2 text-xs font-bold text-black hover:scale-[1.03] transition-all"
          >
            Install
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="shrink-0 text-text-muted hover:text-text p-1"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
