import type L from "leaflet";
import "leaflet/dist/leaflet.css";

let leafletPromise: Promise<typeof L> | null = null;

/**
 * Lazy-loads Leaflet JS on the client side.
 * CSS is co-located here so it loads when any map component initializes.
 */
export function loadLeaflet(): Promise<typeof L> {
  if (leafletPromise) return leafletPromise;
  leafletPromise = import("leaflet").then((mod) => mod.default);
  return leafletPromise;
}
