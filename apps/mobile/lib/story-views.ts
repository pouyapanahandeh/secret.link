import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "sl_viewed_stories";

export async function getViewedStoryIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export async function markStoryViewed(id: string): Promise<Set<string>> {
  const set = await getViewedStoryIds();
  if (!id || set.has(id)) return set;
  set.add(id);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* best effort */
  }
  return set;
}

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
