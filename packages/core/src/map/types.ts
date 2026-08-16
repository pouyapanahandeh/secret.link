/** List-safe map secret shape (camelCase, no client-only fields). */
export interface MapSecretListItem {
  id: string;
  lat: number;
  lng: number;
  emoji: string;
  handle: string | null;
  locationName: string | null;
  cityName: string | null;
  countryName: string | null;
  hasMedia?: boolean;
  revealMode: "timer" | "clicks";
  revealTimerSeconds: number;
  maxClicks: number;
  clickCount: number;
  createdAt: string;
  expiresAt: string;
}

export interface PlaceGroup {
  key: string;
  label: string;
  kind: "city" | "country";
  count: number;
  stories: MapSecretListItem[];
  centroid: { lat: number; lng: number };
  isGrouped: boolean;
}

/** Group when story count is strictly greater than this value (i.e. 4+). */
export const PLACE_GROUP_THRESHOLD = 3;
