import type L from "leaflet";

let leafletPromise: Promise<typeof L> | null = null;

/**
 * Lazy-loads Leaflet on the client side via dynamic import.
 * Vite will code-split the leaflet bundle automatically.
 */
export function loadLeaflet(): Promise<typeof L> {
  if (leafletPromise) return leafletPromise;

  leafletPromise = import("leaflet").then((mod) => {
    // Inject Leaflet CSS if not already present
    if (!document.querySelector('link[href*="leaflet"]')) {
      import("leaflet/dist/leaflet.css");
    }
    return mod.default;
  });

  return leafletPromise;
}
