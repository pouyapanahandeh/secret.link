import { useEffect, useState } from "react";
import { ensurePushSubscription, getPushState, type PushState } from "../lib/push.client";
import { UI_FEATURES } from "../lib/feature-flags";

const DISMISS_KEY = "sl_notif_prompt_dismissed";

/**
 * Surfaces the browser's notification permission state and lets the user enable
 * Web Push with one click. Renders nothing when notifications are already on,
 * unsupported, or the user dismissed the (denied) banner.
 *
 * This makes the previously-silent permission flow visible — especially on
 * desktop, where a dismissed prompt left users with no notifications and no
 * indication why.
 */
export function NotificationPrompt({ token }: { token: string }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setState(getPushState());
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const result = await ensurePushSubscription(token);
      setState(result);
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  // Hidden until we know the state, and when nothing to prompt.
  if (state === null || state === "granted" || state === "unsupported") return null;

  if (state === "denied") {
    if (dismissed) return null;
    return (
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3">
        <span className="text-lg shrink-0">🔕</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text">Notifications are blocked</p>
          <p className="text-xs text-text-muted mt-0.5">
            To get alerts for {UI_FEATURES.messages ? "messages and secrets" : "secrets"}, allow notifications for
            secretlink.life in your browser&apos;s site settings, then reload.
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-text-muted hover:text-text text-sm"
        >
          ✕
        </button>
      </div>
    );
  }

  // state === "default"
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
      <span className="text-lg shrink-0">🔔</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text">Turn on notifications</p>
        <p className="text-xs text-text-muted mt-0.5">
          Get notified the moment someone sends you a {UI_FEATURES.messages ? "message or secret" : "secret"}.
        </p>
      </div>
      <button
        onClick={enable}
        disabled={busy}
        className="shrink-0 text-xs font-medium bg-accent text-black px-3 py-1.5 rounded-full disabled:opacity-60"
      >
        {busy ? "Enabling…" : "Enable"}
      </button>
    </div>
  );
}
