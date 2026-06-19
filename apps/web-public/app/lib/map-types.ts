/** Normalized map secret from the API (camelCase). */
export interface MapSecret {
  id: string;
  message: string;
  lat: number;
  lng: number;
  emoji: string;
  handle: string | null;
  locationName: string | null;
  cityName: string | null;
  mediaPath: string | null;
  mediaType: string | null;
  revealMode: "timer" | "clicks";
  revealTimerSeconds: number;
  maxClicks: number;
  clickCount: number;
  createdAt: string;
  expiresAt: string;
  /** Client-side only: set after a reveal shows limit_reached. */
  _limitReached?: boolean;
  _limitMessage?: string;
}
