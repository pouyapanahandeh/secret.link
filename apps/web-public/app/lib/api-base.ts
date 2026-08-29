/** Public API origin for browser fetches. Uses the page origin so HTTPS stays HTTPS. */
export function browserApiBase(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin.replace(/:3000$/, ":4000").replace(/:3001$/, ":4000");
}
