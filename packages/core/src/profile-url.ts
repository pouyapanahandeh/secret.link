const DEFAULT_ORIGIN = "https://secretlink.life";

/** Public profile page URL (no @ prefix — matches web route /:handle). */
export function getProfileUrl(handle: string, origin = DEFAULT_ORIGIN): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/${encodeURIComponent(handle.toLowerCase())}`;
}

/** Profile URL encoded in QR codes — includes src=qr for scan tracking. */
export function getProfileQrUrl(handle: string, origin = DEFAULT_ORIGIN): string {
  const url = new URL(getProfileUrl(handle, origin));
  url.searchParams.set("src", "qr");
  return url.toString();
}

/** Tracked redirect URL for a social link click (owner-only stats). */
export function getSocialLinkUrl(
  handle: string,
  platform: string,
  apiBase: string,
): string {
  const base = apiBase.replace(/\/$/, "");
  return `${base}/v1/users/link/${encodeURIComponent(handle.toLowerCase())}/${encodeURIComponent(platform.toLowerCase())}`;
}
