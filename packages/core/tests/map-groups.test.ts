import { describe, it, expect } from "vitest";
import {
  countryFromLocationName,
  groupStoriesByPlace,
  placeKeyForSecret,
} from "../src/map/groups.js";
import type { MapSecretListItem } from "../src/map/types.js";

function makeSecret(overrides: Partial<MapSecretListItem> & { id: string; lat: number; lng: number }): MapSecretListItem {
  return {
    emoji: "💬",
    handle: null,
    locationName: null,
    cityName: null,
    countryName: null,
    revealMode: "timer",
    revealTimerSeconds: 30,
    maxClicks: 0,
    clickCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T01:00:00.000Z",
    ...overrides,
  };
}

describe("countryFromLocationName", () => {
  it("returns last segment", () => {
    expect(countryFromLocationName("Budapest, Hungary")).toBe("Hungary");
  });

  it("returns null for empty", () => {
    expect(countryFromLocationName(null)).toBeNull();
  });
});

describe("placeKeyForSecret", () => {
  it("prefers city over country", () => {
    const key = placeKeyForSecret(
      makeSecret({ id: "1", lat: 0, lng: 0, cityName: "Berlin", countryName: "Germany" }),
    );
    expect(key?.kind).toBe("city");
    expect(key?.label).toBe("Berlin");
  });

  it("falls back to country", () => {
    const key = placeKeyForSecret(
      makeSecret({ id: "1", lat: 0, lng: 0, countryName: "Germany" }),
    );
    expect(key?.kind).toBe("country");
  });
});

describe("groupStoriesByPlace", () => {
  it("keeps 5 stories in same city ungrouped", () => {
    const secrets = Array.from({ length: 5 }, (_, i) =>
      makeSecret({ id: String(i), lat: 52 + i * 0.01, lng: 13, cityName: "Berlin" }),
    );
    const { groupedPlaces, ungroupedSecrets } = groupStoriesByPlace(secrets);
    expect(groupedPlaces).toHaveLength(0);
    expect(ungroupedSecrets).toHaveLength(5);
  });

  it("groups 6 stories in same city", () => {
    const secrets = Array.from({ length: 6 }, (_, i) =>
      makeSecret({ id: String(i), lat: 52 + i * 0.01, lng: 13, cityName: "Berlin" }),
    );
    const { groupedPlaces, ungroupedSecrets } = groupStoriesByPlace(secrets);
    expect(groupedPlaces).toHaveLength(1);
    expect(groupedPlaces[0]!.label).toBe("Berlin");
    expect(groupedPlaces[0]!.count).toBe(6);
    expect(groupedPlaces[0]!.isGrouped).toBe(true);
    expect(ungroupedSecrets).toHaveLength(0);
  });

  it("groups by country when no city", () => {
    const secrets = Array.from({ length: 6 }, (_, i) =>
      makeSecret({
        id: String(i),
        lat: 48 + i * 0.1,
        lng: 2,
        countryName: "France",
        locationName: "Somewhere, France",
      }),
    );
    const { groupedPlaces } = groupStoriesByPlace(secrets);
    expect(groupedPlaces[0]!.kind).toBe("country");
    expect(groupedPlaces[0]!.label).toBe("France");
  });

  it("leaves secrets without place ungrouped", () => {
    const secrets = [makeSecret({ id: "1", lat: 0, lng: 0 })];
    const { ungroupedSecrets, groupedPlaces } = groupStoriesByPlace(secrets);
    expect(groupedPlaces).toHaveLength(0);
    expect(ungroupedSecrets).toHaveLength(1);
  });

  it("computes centroid as average", () => {
    const secrets = [
      makeSecret({ id: "1", lat: 52, lng: 13, cityName: "Berlin" }),
      makeSecret({ id: "2", lat: 54, lng: 15, cityName: "Berlin" }),
    ];
    const { allPlaces } = groupStoriesByPlace(secrets);
    expect(allPlaces[0]!.centroid).toEqual({ lat: 53, lng: 14 });
  });
});
