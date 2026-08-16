import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { PlaceGroup } from "@secretlink/core";
import { useMapSecrets } from "../hooks/useMapSecrets";
import type { MapSecret } from "../lib/map-types";
import { PlaceTagBar } from "./PlaceTagBar";
import { PlaceTagActionSheet } from "./PlaceTagActionSheet";
import { MapStorySheet } from "./MapStorySheet";
import { MapControls } from "./MapControls";
import { MapSearchBox } from "./MapSearchBox";
import { StoryViewer } from "./StoryViewer";
import { createEmojiMarkerIcon, createPinMarkerIcon } from "../lib/map-markers";

const PULSE_MS = 1200;

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
  const pulseLayersRef = useRef<any[]>([]);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    secrets,
    loading,
    error,
    refresh,
    groupedPlaces,
    selectedPlaceKey,
    selectPlace,
    clearPlace,
  } = useMapSecrets(initialSecrets);

  const secretsById = useMemo(() => new Map(secrets.map((s) => [s.id, s])), [secrets]);

  const [pendingPin, setPendingPin] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedStory, setSelectedStory] = useState<MapSecret | null>(null);
  const [placeViewer, setPlaceViewer] = useState<{ stories: MapSecret[]; title: string } | null>(null);
  const [actionGroup, setActionGroup] = useState<PlaceGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const clearPulse = useCallback(() => {
    if (pulseTimerRef.current) {
      clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = null;
    }
    const map = mapInstanceRef.current;
    if (!map) {
      pulseLayersRef.current = [];
      return;
    }
    for (const layer of pulseLayersRef.current) {
      try {
        map.removeLayer(layer);
      } catch {
        /* already removed */
      }
    }
    pulseLayersRef.current = [];
  }, []);

  const storiesForGroup = useCallback(
    (group: PlaceGroup) =>
      group.stories
        .map((meta) => secretsById.get(meta.id))
        .filter((s): s is MapSecret => !!s),
    [secretsById],
  );

  const showGroupOnMap = useCallback(
    (group: PlaceGroup) => {
      const map = mapInstanceRef.current;
      const L = leafletRef.current;
      if (!map || !L) return;

      clearPulse();
      selectPlace(group.key);
      setSelectedStory(null);
      setPlaceViewer(null);
      setPendingPin(null);
      if (pinMarkerRef.current) {
        map.removeLayer(pinMarkerRef.current);
        pinMarkerRef.current = null;
      }

      const storyList = storiesForGroup(group);
      if (storyList.length === 0) return;

      const points = storyList.map((s) => [s.lat, s.lng] as [number, number]);
      if (points.length === 1) {
        map.setView(points[0], 13);
      } else {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [80, 80], maxZoom: 14 });
      }

      for (const s of storyList) {
        const pulse = L.circleMarker([s.lat, s.lng], {
          radius: 18,
          fillColor: "#facc15",
          fillOpacity: 0.35,
          color: "#facc15",
          weight: 2,
          opacity: 0.9,
        }).addTo(map);
        pulseLayersRef.current.push(pulse);
      }

      pulseTimerRef.current = setTimeout(() => {
        clearPulse();
      }, PULSE_MS);
    },
    [selectPlace, storiesForGroup, clearPulse],
  );

  const viewGroupStories = useCallback(
    (group: PlaceGroup) => {
      selectPlace(group.key);
      const storyList = storiesForGroup(group);
      if (storyList.length === 0) return;
      setSelectedStory(null);
      setPendingPin(null);
      setPlaceViewer({ stories: storyList, title: group.label });
    },
    [selectPlace, storiesForGroup],
  );

  const renderMarkers = useCallback(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    map.eachLayer((layer: any) => {
      if (layer._isSecretMarker) map.removeLayer(layer);
    });

    for (const s of secrets) {
      const marker = L.marker([s.lat, s.lng], {
        icon: createEmojiMarkerIcon(L, s.emoji, !!s.hasMedia),
      }).addTo(map);
      marker._isSecretMarker = true;
      marker.on("click", () => {
        setPendingPin(null);
        setSelectedStory(s);
        setPlaceViewer(null);
        setActionGroup(null);
        clearPlace();
      });
    }
  }, [secrets, clearPlace]);

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

        map.on("click", (e: any) => {
          setSelectedStory(null);
          setPlaceViewer(null);
          setActionGroup(null);
          clearPlace();
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
  }, [isVisible, clearPlace]);

  useEffect(() => {
    if (isVisible && mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 50);
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 250);
    }
  }, [isVisible]);

  useEffect(() => {
    if (!mapReady || !isVisible) return;
    renderMarkers();
  }, [mapReady, isVisible, renderMarkers]);

  useEffect(() => {
    return () => {
      clearPulse();
    };
  }, [clearPulse]);

  function handlePlaceTagSelect(key: string) {
    const group = groupedPlaces.find((g) => g.key === key);
    if (!group) return;
    selectPlace(group.key);
    setActionGroup(group);
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

  function handleSearchSelect(coords: { lat: number; lng: number }) {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    setSelectedStory(null);
    setPlaceViewer(null);
    setActionGroup(null);
    clearPlace();

    map.setView([coords.lat, coords.lng], 15);
    setPendingPin(coords);
    if (pinMarkerRef.current) map.removeLayer(pinMarkerRef.current);
    pinMarkerRef.current = L.marker([coords.lat, coords.lng], { icon: createPinMarkerIcon(L) }).addTo(map);
  }

  const isEmpty = !loading && secrets.length === 0 && !error && mapReady;

  return (
    <section className="flex flex-col flex-1 min-h-0 h-full">
      <div className="hidden sm:block shrink-0 mb-3 px-0">
        <h2 className="text-lg font-bold">Map</h2>
        <p className="text-xs text-text-muted">Stories dropped near you</p>
      </div>

      {error && (
        <div className="shrink-0 mb-3 mx-4 sm:mx-0 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 flex items-center justify-between gap-2">
          <p className="text-xs text-red-300">{error}</p>
          <button type="button" onClick={refresh} className="text-xs text-accent shrink-0">Retry</button>
        </div>
      )}

      {loading && secrets.length === 0 && (
        <p className="text-xs text-text-muted mb-3 shrink-0 px-4 sm:px-0">Loading stories…</p>
      )}

      <div className="relative flex-1 min-h-0 sm:min-h-[55vh] rounded-none border-0 sm:rounded-2xl sm:border sm:border-border overflow-hidden isolate z-0">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

        <div className="absolute top-3 left-3 right-3 sm:left-14 sm:right-14 z-[1000] flex flex-col gap-2 pointer-events-auto">
          <MapSearchBox onSelect={handleSearchSelect} />
          <PlaceTagBar
            groupedPlaces={groupedPlaces}
            selectedPlaceKey={selectedPlaceKey}
            onSelect={handlePlaceTagSelect}
          />
        </div>

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

      {actionGroup && (
        <PlaceTagActionSheet
          group={actionGroup}
          onViewStories={() => {
            const group = actionGroup;
            setActionGroup(null);
            viewGroupStories(group);
          }}
          onShowOnMap={() => {
            const group = actionGroup;
            setActionGroup(null);
            showGroupOnMap(group);
          }}
          onClose={() => {
            setActionGroup(null);
            clearPlace();
          }}
        />
      )}

      {placeViewer && (
        <StoryViewer
          initialStories={placeViewer.stories}
          title={placeViewer.title}
          onClose={() => {
            setPlaceViewer(null);
            clearPlace();
          }}
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
