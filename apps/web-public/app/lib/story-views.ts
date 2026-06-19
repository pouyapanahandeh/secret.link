/**
 * Client-side persistence of which story (map-secret) IDs the current user has
 * already watched. Stories are ephemeral (they expire), so a localStorage set
 * is sufficient — no server round-trip or cross-device sync needed.
 *
 * All access is guarded for SSR safety so this module can be imported anywhere.
 */

const STORAGE_KEY = "sl_viewed_stories";

/** Read the set of viewed story IDs from localStorage (empty during SSR). */
export function getViewedStoryIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

/** Mark a story ID as viewed and persist. Returns the updated set. */
export function markStoryViewed(id: string): Set<string> {
  const set = getViewedStoryIds();
  if (!id || set.has(id)) return set;
  set.add(id);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
    } catch {
      /* quota / private mode — best effort */
    }
  }
  return set;
}

/**
 * Given a map of handle → active story IDs, return the set of handles whose
 * stories have ALL been viewed (so their ring should appear dimmed).
 */
export function computeViewedHandles(
  storyIdsByHandle: Record<string, string[]>,
  viewed: Set<string>,
): Set<string> {
  const result = new Set<string>();
  for (const [handle, ids] of Object.entries(storyIdsByHandle)) {
    if (ids.length > 0 && ids.every((id) => viewed.has(id))) {
      result.add(handle.toLowerCase());
    }
  }
  return result;
}
