/** Normalized map secret from the API (camelCase). */
export interface MapSecret {
  id: string;
  /** Client-decrypted plaintext after /reveal. Never stored on the server. */
  message?: string;
  /** Encrypted reveal fields (client decrypts to message). */
  ciphertext?: string;
  nonce?: string;
  key?: string;
  legacy?: boolean;
  lat: number;
  lng: number;
  emoji: string;
  handle: string | null;
  locationName: string | null;
  cityName: string | null;
  countryName: string | null;
  /** Only present after calling /reveal. */
  mediaPath?: string | null;
  /** Only present after calling /reveal. */
  mediaType?: string | null;
  /** Indicates media exists (from list response). */
  hasMedia?: boolean;
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
