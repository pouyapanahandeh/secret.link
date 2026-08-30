/**
 * CARTO raster basemaps now watermark every tile with "API KEY REQUIRED".
 * OSM raster tiles plus a CSS invert keep the dark look without a vendor key.
 */
export const DARK_BASEMAP_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const DARK_BASEMAP_OPTIONS = {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
  className: "map-tiles-dark",
} as const;

export function addDarkBasemap(L: { tileLayer: (...args: any[]) => any }, map: unknown) {
  return L.tileLayer(DARK_BASEMAP_URL, DARK_BASEMAP_OPTIONS).addTo(map);
}
