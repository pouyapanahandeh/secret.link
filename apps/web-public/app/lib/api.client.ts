export function getApiBase(): string {
  // In production, VITE_API_URL should be set
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Dev fallback: assume API on port 4000
  const origin = window.location.origin;
  return origin.replace(/:3000$/, ":4000").replace(/:3001$/, ":4000");
}
