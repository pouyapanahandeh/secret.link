import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { PlaceGroup } from "@secretlink/core";
import { useMapSecrets } from "../hooks/useMapSecrets";
import type { MapSecret } from "../lib/map-types";
import { PlaceTagBar } from "./PlaceTagBar";
import { StoryGroupSheet } from "./StoryGroupSheet";
import { MapStorySheet } from "./MapStorySheet";
import { MapControls } from "./MapControls";
import { createClusterMarkerIcon, createEmojiMarkerIcon, createPinMarkerIcon } from "../lib/map-markers";

interface MapTabProps {
  initialSecrets: MapSecret[];
  isVisible: boolean;
  onRequestComposer: (coords: { lat: number; lng: number }) => void;
  onViewUserStories?: (handle: string) => void;
}

export function MapTab({
  initialSecrets,
  isVisible,
  onRequestComposer,
  onViewUserStories,
}: MapTabProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const pinMarkerRef = useRef<any>(null);

  const {
    secrets,
    loading,
    error,
    refresh,
    groupedPlaces,
    ungroupedSecrets,
    selectedPlaceKey,
    selectPlace,
    clearPlace,
  } = useMapSecrets(initialSecrets);

  const secretsById = useMemo(() => new Map(secrets.map((s) => [s.id, s])), [secrets]);

  const [pendingPin, setPendingPin] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedStory, setSelectedStory] = useState<MapSecret | null>(null);
  const [groupSheet, setGroupSheet] = useState<PlaceGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const openGroup = useCallback(
    (group: PlaceGroup) => {
      selectPlace(group.key);
      setGroupSheet(group);
      const map = mapInstanceRef.current;
      if (map) map.setView([group.centroid.lat, group.centroid.lng], 10);
    },
    [selectPlace],
  );

  const renderMarkers = useCallback(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    map.eachLayer((layer: any) => {
      if (layer._isSecretMarker) map.removeLayer(layer);
    });

    for (const item of ungroupedSecrets) {
      const s = secretsById.get(item.id);
      if (!s) continue;
      const marker = L.marker([s.lat, s.lng], { icon: createEmojiMarkerIcon(L, s.emoji) }).addTo(map);
      marker._isSecretMarker = true;
      marker.on("click", () => {
        setPendingPin(null);
        setSelectedStory(s);
        setGroupSheet(null);
      });
    }

    for (const group of groupedPlaces) {
      const marker = L.marker([group.centroid.lat, group.centroid.lng], {
        icon: createClusterMarkerIcon(L, group),
      }).addTo(map);
      marker._isSecretMarker = true;
      marker.on("click", () => openGroup(group));
    }
  }, [ungroupedSecrets, groupedPlaces, secretsById, openGroup]);

  useEffect(() => {
    if (!isVisible) return;

    refresh();

    const poll = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(poll);
  }, [isVisible, refresh]);

  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;

    import("../lib/leaflet.client")
      .then(({ loadLeaflet }) => loadLeaflet())
      .then((L) => {
        if (cancelled || !mapContainerRef.current) return;

        if (mapInstanceRef.current) {
          leafletRef.current = L;
          setMapReady(true);
          setTimeout(() => mapInstanceRef.current?.invalidateSize(), 50);
          return;
        }

        leafletRef.current = L;
        const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([51.505, -0.09], 3);
        mapInstanceRef.current = map;

        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
          maxZoom: 19,
        }).addTo(map);

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 13),
            () => {},
          );
        }

        map.on("click", (e: any) => {
          setSelectedStory(null);
          setGroupSheet(null);
          const pos = { lat: e.latlng.lat, lng: e.latlng.lng };
          setPendingPin(pos);
          if (pinMarkerRef.current) map.removeLayer(pinMarkerRef.current);
          pinMarkerRef.current = L.marker([pos.lat, pos.lng], { icon: createPinMarkerIcon(L) }).addTo(map);
        });

        setTimeout(() => map.invalidateSize(), 100);
        setMapReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isVisible]);

  useEffect(() => {
    if (isVisible && mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 50);
    }
  }, [isVisible]);

  useEffect(() => {
    if (!mapReady || !isVisible) return;
    renderMarkers();
  }, [mapReady, isVisible, renderMarkers]);

  useEffect(() => {
    if (!selectedPlaceKey) return;
    const group = groupedPlaces.find((g) => g.key === selectedPlaceKey);
    if (group) setGroupSheet(group);
  }, [selectedPlaceKey, groupedPlaces]);

  function handlePlaceTagSelect(key: string | null) {
    if (key === null) {
      clearPlace();
      setGroupSheet(null);
      return;
    }
    const group = groupedPlaces.find((g) => g.key === key);
    if (group) openGroup(group);
  }

  function zoomIn() {
    mapInstanceRef.current?.zoomIn();
  }

  function zoomOut() {
    mapInstanceRef.current?.zoomOut();
  }

  function locateMe() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const map = mapInstanceRef.current;
        const L = leafletRef.current;
        if (map && L) {
          map.setView([pos.coords.latitude, pos.coords.longitude], 15);
          const marker = L.circleMarker([pos.coords.latitude, pos.coords.longitude], {
            radius: 8, fillColor: "#facc15", fillOpacity: 1, color: "#fff", weight: 2,
          }).addTo(map);
          setTimeout(() => map.removeLayer(marker), 5000);
        }
      },
      () => {},
    );
  }

  const isEmpty = !loading && secrets.length === 0 && !error && mapReady;

  return (
    <section className="flex flex-col flex-1 min-h-0 h-full">
      <div className="shrink-0 mb-3">
        <h2 className="text-lg font-bold">Map</h2>
        <p className="text-xs text-text-muted">Stories dropped near you</p>
      </div>

      {error && (
        <div className="shrink-0 mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 flex items-center justify-between gap-2">
          <p className="text-xs text-red-300">{error}</p>
          <button type="button" onClick={refresh} className="text-xs text-accent shrink-0">Retry</button>
        </div>
      )}

      {loading && secrets.length === 0 && (
        <p className="text-xs text-text-muted mb-3 shrink-0">Loading stories…</p>
      )}

      <PlaceTagBar groupedPlaces={groupedPlaces} selectedPlaceKey={selectedPlaceKey} onSelect={handlePlaceTagSelect} />

      <div className="relative flex-1 min-h-[45vh] sm:min-h-[55vh] rounded-2xl border border-border overflow-hidden isolate z-0 mb-2 sm:mb-0">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

        <MapControls onZoomIn={zoomIn} onZoomOut={zoomOut} onLocate={locateMe} />

        {isEmpty && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center pointer-events-none">
            <div className="bg-surface/90 backdrop-blur-sm rounded-xl border border-border px-6 py-4 text-center max-w-xs">
              <p className="text-sm text-text-muted">No stories nearby yet</p>
              <p className="text-xs text-text-muted/70 mt-1">Be the first to add one</p>
            </div>
          </div>
        )}

        {pendingPin && (
          <button
            type="button"
            onClick={() => onRequestComposer(pendingPin)}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-black shadow-lg hover:scale-[1.03] transition-all pointer-events-auto"
          >
            Add story here
          </button>
        )}
      </div>

      {groupSheet && (
        <StoryGroupSheet
          group={groupSheet}
          onClose={() => { setGroupSheet(null); clearPlace(); }}
          onSelectStory={(s) => { setSelectedStory(s); setGroupSheet(null); }}
          secretsById={secretsById}
        />
      )}

      {selectedStory && (
        <MapStorySheet
          secret={selectedStory}
          onClose={() => setSelectedStory(null)}
          onViewUserStories={onViewUserStories}
        />
      )}
    </section>
  );
}
