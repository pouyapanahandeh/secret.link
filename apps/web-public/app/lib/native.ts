import { useRouteLoaderData } from "@remix-run/react";

/**
 * The Capacitor shell in `apps/mobile-public` loads this site in a native
 * WebView. It appends this token to the user agent (see its
 * `capacitor.config.json`) so the server can render app chrome on the first
 * response instead of flashing the marketing layout first.
 */
export const NATIVE_UA_TOKEN = "SecretlinkApp";

type CapacitorBridge = { isNativePlatform?: () => boolean };

/** Client-side check. Prefer `useIsNativeApp()` for anything that renders. */
export function isNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  const bridge = (window as Window & { Capacitor?: CapacitorBridge }).Capacitor;
  return bridge?.isNativePlatform?.() === true;
}

/** True when this document is being rendered for the native app shell. */
export function useIsNativeApp(): boolean {
  const data = useRouteLoaderData<{ isNativeApp?: boolean }>("root");
  return data?.isNativeApp === true;
}
