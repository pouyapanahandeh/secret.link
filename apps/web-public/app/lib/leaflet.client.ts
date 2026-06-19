import type L from "leaflet";

let leafletPromise: Promise<typeof L> | null = null;

/**
 * Lazy-loads Leaflet JS on the client side.
 * CSS is loaded via root.tsx links() so it's always in <head> before any map initializes.
 */
export function loadLeaflet(): Promise<typeof L> {
  if (leafletPromise) return leafletPromise;
  leafletPromise = import("leaflet").then((mod) => mod.default);
  return leafletPromise;
}
