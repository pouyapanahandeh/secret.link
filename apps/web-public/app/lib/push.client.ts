// Web Push subscription helper (browser-only).
//
// Registers the current device with the push service so the server can deliver
// OS-level notifications (lock screen / browser) even when the app is closed.
// Best-effort and idempotent — safe to call on every dashboard mount.

import { getApiBase } from "./api.client";

/** Convert a base64url VAPID key into the Uint8Array the Push API expects. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** Possible push/notification states for this browser. */
export type PushState = "unsupported" | "default" | "denied" | "granted";

/** True when this browser can do Web Push at all. */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Current notification permission, or "unsupported" when push isn't available. */
export function getPushState(): PushState {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission as PushState;
}

/**
 * Ensure this browser is subscribed to Web Push and the subscription is
 * registered server-side. Requests notification permission if not yet decided.
 * No-op when push isn't supported or permission is denied.
 *
 * Returns the resulting {@link PushState} so callers (e.g. an "enable
 * notifications" CTA) can react to the outcome.
 */
export async function ensurePushSubscription(token: string): Promise<PushState> {
  if (!isPushSupported()) return "unsupported";
  if (!token) return getPushState();

  try {
    // Don't pester users who already said no.
    if (Notification.permission === "denied") return "denied";
    if (Notification.permission === "default") {
      const result = await Notification.requestPermission();
      if (result !== "granted") return result as PushState;
    }

    const apiBase = getApiBase();

    // Fetch the server's VAPID public key.
    const keyRes = await fetch(`${apiBase}/v1/notifications/vapid-public-key`);
    if (!keyRes.ok) return getPushState();
    const { publicKey } = (await keyRes.json()) as { publicKey?: string };
    if (!publicKey) return getPushState(); // push disabled server-side

    const registration = await navigator.serviceWorker.ready;

    // Reuse an existing subscription, or create a new one.
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }

    // Register (or refresh) the subscription server-side.
    await fetch(`${apiBase}/v1/notifications/subscribe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });

    return "granted";
  } catch {
    /* push unsupported / blocked — silently ignore */
    return getPushState();
  }
}
