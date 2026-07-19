import { useCallback, useEffect, useMemo, useState } from "react";
import { groupStoriesByPlace } from "@secretlink/core";
import { getApiBase } from "../lib/api.client";
import type { MapSecret } from "../lib/map-types";

function toListItem(s: MapSecret) {
  return {
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    emoji: s.emoji,
    handle: s.handle,
    locationName: s.locationName,
    cityName: s.cityName,
    countryName: s.countryName ?? null,
    hasMedia: s.hasMedia,
    revealMode: s.revealMode,
    revealTimerSeconds: s.revealTimerSeconds,
    maxClicks: s.maxClicks,
    clickCount: s.clickCount,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
  };
}

export function useMapSecrets(initialSecrets: MapSecret[]) {
  const [secrets, setSecrets] = useState<MapSecret[]>(initialSecrets);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlaceKey, setSelectedPlaceKey] = useState<string | null>(null);

  useEffect(() => {
    setSecrets(initialSecrets);
  }, [initialSecrets]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBase()}/v1/secrets/map`);
      if (!res.ok) {
        setError("Could not load stories. Please try again.");
        return;
      }
      const data = await res.json();
      setSecrets(Array.isArray(data) ? data : []);
    } catch {
      setError("Could not load stories. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const { groupedPlaces, ungroupedSecrets } = useMemo(
    () => groupStoriesByPlace(secrets.map(toListItem)),
    [secrets],
  );

  const selectedPlace = useMemo(
    () => groupedPlaces.find((g) => g.key === selectedPlaceKey) ?? null,
    [groupedPlaces, selectedPlaceKey],
  );

  const selectPlace = useCallback((key: string | null) => {
    setSelectedPlaceKey(key);
  }, []);

  const clearPlace = useCallback(() => {
    setSelectedPlaceKey(null);
  }, []);

  return {
    secrets,
    loading,
    error,
    refresh,
    groupedPlaces,
    ungroupedSecrets,
    selectedPlace,
    selectedPlaceKey,
    selectPlace,
    clearPlace,
  };
}
