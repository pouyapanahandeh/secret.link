/** Public API origin (no /v1 suffix). Safe for SSR when `fallbackOrigin` is passed. */
export function getApiBase(fallbackOrigin?: string): string {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (fromEnv) {
    return String(fromEnv).replace(/\/v1\/?$/, "").replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    return origin.replace(/:3000$/, ":4000").replace(/:3001$/, ":4000");
  }

  if (fallbackOrigin) {
    return fallbackOrigin.replace(/:3000$/, ":4000").replace(/:3001$/, ":4000");
  }

  return "https://secretlink.life";
}
