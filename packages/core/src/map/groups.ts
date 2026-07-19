import type { MapSecretListItem, PlaceGroup } from "./types.js";
import { PLACE_GROUP_THRESHOLD } from "./types.js";

/** Parse country from a Nominatim-style display name (last comma-separated segment). */
export function countryFromLocationName(locationName: string | null | undefined): string | null {
  if (!locationName?.trim()) return null;
  const parts = locationName.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return parts[parts.length - 1] ?? null;
}

export function placeKeyForSecret(
  secret: MapSecretListItem,
): { kind: "city" | "country"; label: string; key: string } | null {
  const city = secret.cityName?.trim();
  if (city) {
    return { kind: "city", label: city, key: `city:${city.toLowerCase()}` };
  }
  const country =
    secret.countryName?.trim() ||
    countryFromLocationName(secret.locationName)?.trim() ||
    null;
  if (country) {
    return { kind: "country", label: country, key: `country:${country.toLowerCase()}` };
  }
  return null;
}

function computeCentroid(stories: MapSecretListItem[]): { lat: number; lng: number } {
  if (stories.length === 0) return { lat: 0, lng: 0 };
  const sum = stories.reduce(
    (acc, s) => ({ lat: acc.lat + s.lat, lng: acc.lng + s.lng }),
    { lat: 0, lng: 0 },
  );
  return {
    lat: Math.round((sum.lat / stories.length) * 1e6) / 1e6,
    lng: Math.round((sum.lng / stories.length) * 1e6) / 1e6,
  };
}

export function groupStoriesByPlace(
  secrets: MapSecretListItem[],
  options?: { threshold?: number },
): {
  groupedPlaces: PlaceGroup[];
  ungroupedSecrets: MapSecretListItem[];
  allPlaces: PlaceGroup[];
} {
  const threshold = options?.threshold ?? PLACE_GROUP_THRESHOLD;
  const buckets = new Map<string, PlaceGroup>();
  const ungroupedSecrets: MapSecretListItem[] = [];

  for (const secret of secrets) {
    const place = placeKeyForSecret(secret);
    if (!place) {
      ungroupedSecrets.push(secret);
      continue;
    }
    const existing = buckets.get(place.key);
    if (existing) {
      existing.stories.push(secret);
      existing.count += 1;
    } else {
      buckets.set(place.key, {
        key: place.key,
        label: place.label,
        kind: place.kind,
        count: 1,
        stories: [secret],
        centroid: { lat: secret.lat, lng: secret.lng },
        isGrouped: false,
      });
    }
  }

  const allPlaces: PlaceGroup[] = [];
  const groupedPlaces: PlaceGroup[] = [];

  for (const group of buckets.values()) {
    group.centroid = computeCentroid(group.stories);
    group.isGrouped = group.count > threshold;
    allPlaces.push(group);
    if (group.isGrouped) {
      groupedPlaces.push(group);
    } else {
      ungroupedSecrets.push(...group.stories);
    }
  }

  groupedPlaces.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  allPlaces.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return { groupedPlaces, ungroupedSecrets, allPlaces };
}
