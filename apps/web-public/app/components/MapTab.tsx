import { useEffect, useRef, useState } from "react";
import { Link } from "@remix-run/react";
import { getApiBase } from "../lib/api.client";
import type { MapSecret } from "../lib/map-types";
import { StoryComposer } from "./StoryComposer";
import { MapContentSkeleton } from "./DashboardSkeleton";

interface MapTabProps {
  user: { handle: string; avatarUrl?: string | null };
  following: Array<{ handle?: string; avatarUrl?: string | null }>;
  token: string;
}

const REPORT_REASONS = [
  { value: "spam", label: "Spam / scam" },
  { value: "harassment", label: "Harassment" },
  { value: "hate", label: "Hate speech" },
  { value: "sexual", label: "Sexual content" },
  { value: "violence", label: "Violence" },
  { value: "illegal", label: "Illegal content" },
  { value: "other", label: "Other" },
];

function mapSecretCity(secret: MapSecret): string {
  if (secret.cityName) return secret.cityName;
  if (secret.locationName) return secret.locationName.split(",")[0]?.trim() ?? "";
  return "";
}

function mapTimeRemaining(expiresAt: string) {
  if (!expiresAt) return "Unknown";
  const normalized = expiresAt.includes("T") ? expiresAt : expiresAt.replace(" ", "T") + "Z";
  const ms = new Date(normalized).getTime() - Date.now();
  if (isNaN(ms) || ms <= 0) return "Expired";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m left`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m left`;
}

export function MapTab({ user, following, token }: MapTabProps) {
  // Map instance refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const mapPinMarkerRef = useRef<any>(null);

  // Data
  const [mapReady, setMapReady] = useState(false);
  const [mapSecrets, setMapSecrets] = useState<MapSecret[]>([]);
  const [selectedMapSecret, setSelectedMapSecret] = useState<MapSecret | null>(null);
  const [mapSecretRevealed, setMapSecretRevealed] = useState(false);

  // Post form state — now uses StoryComposer modal
  const [showMapPost, setShowMapPost] = useState(false);
  const [mapClickedPos, setMapClickedPos] = useState<{ lat: number; lng: number } | null>(null);

  // City filter
  const [mapCityFilter, setMapCityFilter] = useState<string | null>(null);

  // Report state
  const [mapReportOpen, setMapReportOpen] = useState(false);
  const [mapReportReason, setMapReportReason] = useState("spam");
  const [mapReportDetails, setMapReportDetails] = useState("");
  const [mapReportSubmitting, setMapReportSubmitting] = useState(false);
  const [mapReportResult, setMapReportResult] = useState<string | null>(null);

  // Reveal countdown
  const [revealCountdown, setRevealCountdown] = useState<number | null>(null);
  const revealTimerRef = useRef<any>(null);

  // ─── Map init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    import("../lib/leaflet.client")
      .then(({ loadLeaflet }) => loadLeaflet())
      .then((L) => {
        if (cancelled) return;
        initMap(L);
      })
      .catch(() => {
        if (!cancelled) setMapReady(true);
      });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  function initMap(L?: any) {
    if (!L || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([51.505, -0.09], 3);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "",
      maxZoom: 19,
    }).addTo(map);

    map.attributionControl.remove();
    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => map.invalidateSize(), 500);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 13),
        () => {},
      );
    }

    map.on("click", (e: any) => {
      setMapClickedPos({ lat: e.latlng.lat, lng: e.latlng.lng });
      setShowMapPost(true);
      setSelectedMapSecret(null);
      const Leaflet = (window as any).L;
      if (mapPinMarkerRef.current) map.removeLayer(mapPinMarkerRef.current);
      const pinIcon = Leaflet.divIcon({
        html: '<div style="font-size:28px;text-align:center;line-height:34px;">📍</div>',
        className: "",
        iconSize: [34, 34],
        iconAnchor: [17, 34],
      });
      mapPinMarkerRef.current = Leaflet.marker([e.latlng.lat, e.latlng.lng], { icon: pinIcon }).addTo(map);
    });

    loadMapSecrets(map);
  }

  // ─── Markers ──────────────────────────────────────────────────────────────
  function renderMapMarkers(allSecrets: MapSecret[], map?: any) {
    const m = map || mapInstanceRef.current;
    const Leaflet = (window as any).L;
    if (!Leaflet || !m) return;

    m.eachLayer((layer: any) => {
      if (layer._isSecretMarker) m.removeLayer(layer);
    });

    const visibleSecrets = mapCityFilter
      ? allSecrets.filter((s) => mapSecretCity(s).toLowerCase() === mapCityFilter.toLowerCase())
      : allSecrets;

    visibleSecrets.forEach((s) => {
      const icon = Leaflet.divIcon({
        className: "secret-marker",
        html: `<div style="font-size:24px;cursor:pointer;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">${s.emoji}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      const marker = Leaflet.marker([s.lat, s.lng], { icon }).addTo(m);
      marker._isSecretMarker = true;
      marker.on("click", () => {
        setSelectedMapSecret(s);
        setMapSecretRevealed(false);
        setShowMapPost(false);
        setMapReportOpen(false);
        setMapReportResult(null);
      });
    });
  }

  useEffect(() => {
    renderMapMarkers(mapSecrets);
  }, [mapCityFilter, mapSecrets]);

  // ─── Load secrets ─────────────────────────────────────────────────────────
  async function loadMapSecrets(map?: any) {
    const m = map || mapInstanceRef.current;
    if (!m) {
      setMapReady(true);
      return;
    }
    try {
      const res = await fetch(`${getApiBase()}/v1/secrets/map`);
      if (!res.ok) return;
      const data = await res.json();
      const secrets: MapSecret[] = Array.isArray(data) ? data : [];
      setMapSecrets(secrets);
      renderMapMarkers(secrets, m);
    } catch {} finally {
      setMapReady(true);
    }
  }

  // ─── Post ─────────────────────────────────────────────────────────────────
  // ─── Report ───────────────────────────────────────────────────────────────
  async function submitMapReport() {
    if (!selectedMapSecret?.id) return;
    setMapReportSubmitting(true);
    setMapReportResult(null);
    try {
      const res = await fetch(`${getApiBase()}/v1/secrets/map/${selectedMapSecret.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: mapReportReason, details: mapReportDetails.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMapReportResult(data?.error ? String(data.error) : "Could not send report. Please try again.");
        return;
      }
      setMapReportResult("Thanks. Your report was submitted.");
      setMapReportDetails("");
      setMapReportOpen(false);
    } catch {
      setMapReportResult("Could not send report. Please try again.");
    } finally {
      setMapReportSubmitting(false);
    }
  }

  // ─── Derived data ────────────────────────────────────────────────────────
  const cityGroups = Object.values(
    mapSecrets.reduce((acc: Record<string, { city: string; count: number; sample?: MapSecret }>, s) => {
      const city = mapSecretCity(s);
      if (!city) return acc;
      if (!acc[city]) acc[city] = { city, count: 0, sample: s };
      acc[city]!.count += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b.count - a.count);

  function avatarForCitySample(sample?: MapSecret): string | null {
    if (!sample?.handle) return null;
    const h = String(sample.handle).replace(/^@/, "").toLowerCase();
    if (user.handle?.toLowerCase?.() === h) return user.avatarUrl ?? null;
    const found = following.find(
      (f) => (f.handle ?? "").replace(/^@/, "").toLowerCase() === h,
    );
    return found?.avatarUrl ?? null;
  }

  const visibleMapSecrets = mapCityFilter
    ? mapSecrets.filter((s) => mapSecretCity(s).toLowerCase() === mapCityFilter!.toLowerCase())
    : mapSecrets;

  // ─── Render ───────────────────────────────────────────────────────────────
  if (!mapReady) {
    return (
      <section>
        <MapContentSkeleton />
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-bold mb-4">🗺️ Secret Map</h2>
      <p className="text-xs text-text-muted mb-4">Tap anywhere on the map to drop a secret</p>

      {/* City filter chips */}
      {cityGroups.length > 0 && (
        <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setMapCityFilter(null)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs border transition-colors ${
              mapCityFilter === null ? "bg-accent/20 border-accent text-accent" : "bg-surface border-border text-text-muted"
            }`}
          >
            All cities
          </button>
          {cityGroups.map((g) => {
            const avatar = avatarForCitySample(g.sample);
            return (
              <button
                key={g.city}
                type="button"
                onClick={() => {
                  setMapCityFilter(g.city);
                  const first = mapSecrets.find((s) => mapSecretCity(s) === g.city);
                  if (first && mapInstanceRef.current) mapInstanceRef.current.setView([first.lat, first.lng], 10);
                }}
                className={`shrink-0 flex items-center gap-2 rounded-full px-2 py-1.5 border transition-colors ${
                  mapCityFilter === g.city ? "bg-accent/20 border-accent" : "bg-surface border-border hover:border-accent/40"
                }`}
              >
                <span className="w-6 h-6 rounded-full overflow-hidden bg-surface-raised border border-border flex items-center justify-center text-[10px] font-bold text-text">
                  {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : g.city.slice(0, 2).toUpperCase()}
                </span>
                <span className="text-xs text-text">{g.city}</span>
                <span className="text-[10px] text-text-muted">{g.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Map container */}
      <div className="relative rounded-2xl border border-border overflow-hidden" style={{ height: "400px" }}>
        <div ref={mapContainerRef} className="w-full h-full" />
        {/* Locate me button */}
        <button
          onClick={() => {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const map = mapInstanceRef.current;
                  const L = (window as any).L;
                  if (map && L) {
                    map.setView([pos.coords.latitude, pos.coords.longitude], 15);
                    const marker = L.circleMarker([pos.coords.latitude, pos.coords.longitude], {
                      radius: 8, fillColor: '#facc15', fillOpacity: 1, color: '#fff', weight: 2
                    }).addTo(map);
                    setTimeout(() => map.removeLayer(marker), 5000);
                  }
                },
                () => {},
              );
            }
          }}
          className="absolute bottom-4 right-4 z-[1000] w-10 h-10 rounded-full bg-surface-raised border border-border shadow-lg flex items-center justify-center hover:border-accent/50 transition-colors"
          aria-label="Locate me"
        >
          <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.364-6.364l-1.414 1.414M7.05 16.95l-1.414 1.414m12.728 0l-1.414-1.414M7.05 7.05L5.636 5.636M12 8a4 4 0 100 8 4 4 0 000-8z" />
          </svg>
        </button>
      </div>

      {/* Selected secret popup */}
      {selectedMapSecret && (
        <div className="mt-4 bg-surface-raised rounded-xl border border-border p-4 relative">
          <button onClick={() => { setSelectedMapSecret(null); setMapSecretRevealed(false); setRevealCountdown(null); if (revealTimerRef.current) clearInterval(revealTimerRef.current); }} className="absolute top-2 right-3 text-text-muted hover:text-text text-lg">×</button>

          {!mapSecretRevealed ? (
            <div className="text-center py-4">
              <span className="text-4xl block mb-3">{selectedMapSecret.emoji}</span>
              <p className="text-sm text-text-muted mb-1">
                {selectedMapSecret.handle ? `@${selectedMapSecret.handle} dropped a secret` : "Someone dropped a secret"}
              </p>
              {(selectedMapSecret.locationName || selectedMapSecret.cityName) && (
                <p className="text-xs text-text-muted mb-1">
                  📍 {selectedMapSecret.locationName || selectedMapSecret.cityName}
                </p>
              )}
              <p className="text-xs text-text-muted mb-2">⏳ {mapTimeRemaining(selectedMapSecret.expiresAt)}</p>
              <p className="text-xs text-text-muted mb-4">
                {selectedMapSecret.revealMode === "clicks"
                  ? `👆 ${selectedMapSecret.clickCount}/${selectedMapSecret.maxClicks} reveals used`
                  : `⏱️ Disappears ${selectedMapSecret.revealTimerSeconds}s after reveal`
                }
              </p>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`${getApiBase()}/v1/secrets/map/${selectedMapSecret.id}/reveal`, { method: "POST" });
                    const data = await res.json();
                    if (!res.ok) {
                      if (data.error === "limit_reached") {
                        setSelectedMapSecret({ ...selectedMapSecret, _limitReached: true, _limitMessage: data.message });
                        setMapSecretRevealed(true);
                      }
                      return;
                    }
                    setSelectedMapSecret({ ...selectedMapSecret, ...data });
                    setMapSecretRevealed(true);
                    if (data.revealMode === "timer") {
                      const secs = data.revealTimerSeconds ?? 30;
                      setRevealCountdown(secs);
                      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
                      revealTimerRef.current = setInterval(() => {
                        setRevealCountdown((prev: number | null) => {
                          if (prev === null || prev <= 1) {
                            clearInterval(revealTimerRef.current);
                            setMapSecretRevealed(false);
                            setSelectedMapSecret(null);
                            return null;
                          }
                          return prev - 1;
                        });
                      }, 1000);
                    }
                  } catch {}
                }}
                className="rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-black hover:scale-[1.03] transition-all"
              >
                Tap to reveal 👁️
              </button>
            </div>
          ) : selectedMapSecret._limitReached ? (
            <div className="text-center py-6">
              <span className="text-4xl block mb-3">🚫</span>
              <p className="text-sm text-text font-medium">{selectedMapSecret._limitMessage || "This secret has reached its reveal limit."}</p>
              <p className="text-xs text-text-muted mt-2">No more reveals available</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {revealCountdown !== null && (
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-1000"
                      style={{ width: `${(revealCountdown / (selectedMapSecret.revealTimerSeconds)) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-accent font-mono">{revealCountdown}s</span>
                </div>
              )}
              {selectedMapSecret.revealMode === "clicks" && (
                <div className="text-xs text-text-muted">
                  👆 {selectedMapSecret.clickCount}/{selectedMapSecret.maxClicks} reveals used
                </div>
              )}
              <div className="flex items-start gap-3">
                <span className="text-2xl">{selectedMapSecret.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-text text-sm leading-relaxed break-words whitespace-pre-wrap">{selectedMapSecret.message}</p>
                  <div className="flex items-center gap-2 mt-3">
                    {selectedMapSecret.handle && (
                      <Link to={`/${selectedMapSecret.handle}`} className="text-xs text-accent">@{selectedMapSecret.handle}</Link>
                    )}
                    {(selectedMapSecret.locationName || selectedMapSecret.cityName) && (
                      <span className="text-xs text-text-muted">
                        📍 {selectedMapSecret.locationName || selectedMapSecret.cityName}
                      </span>
                    )}
                    <span className="text-xs text-text-muted">⏳ {mapTimeRemaining(selectedMapSecret.expiresAt)}</span>
                  </div>
                </div>
              </div>
              {selectedMapSecret.mediaPath && (
                <div className="mt-2">
                  {(selectedMapSecret.mediaType ?? "").startsWith("image/") ? (
                    <img
                      src={`${getApiBase()}/v1/secrets/blob/${selectedMapSecret.mediaPath}`}
                      alt="Attached image"
                      className="max-w-full max-h-64 rounded-xl border border-border"
                    />
                  ) : (selectedMapSecret.mediaType ?? "").startsWith("video/") ? (
                    <video
                      src={`${getApiBase()}/v1/secrets/blob/${selectedMapSecret.mediaPath}`}
                      controls
                      className="max-w-full max-h-64 rounded-xl border border-border"
                    />
                  ) : (
                    <a
                      href={`${getApiBase()}/v1/secrets/blob/${selectedMapSecret.mediaPath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-accent bg-accent/10 px-4 py-2 rounded-lg hover:bg-accent/20 transition-colors"
                    >
                      📎 Download attachment
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Report section */}
          <div className="mt-4 pt-3 border-t border-border/70">
            <button
              type="button"
              onClick={() => { setMapReportOpen((v) => !v); setMapReportResult(null); }}
              className="text-xs text-red-300 hover:text-red-200"
            >
              🚩 Report this secret
            </button>

            {mapReportOpen && (
              <div className="mt-3 space-y-2">
                <select
                  value={mapReportReason}
                  onChange={(e) => setMapReportReason(e.target.value)}
                  className="w-full text-xs bg-surface border border-border rounded-lg px-2 py-1.5 text-text"
                >
                  {REPORT_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <textarea
                  value={mapReportDetails}
                  onChange={(e) => setMapReportDetails(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Tell us what is wrong (optional)"
                  className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-xs text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-red-400/30"
                />
                <button
                  type="button"
                  onClick={submitMapReport}
                  disabled={mapReportSubmitting}
                  className="rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {mapReportSubmitting ? "Submitting..." : "Submit report"}
                </button>
              </div>
            )}

            {mapReportResult && <p className="mt-2 text-xs text-text-muted">{mapReportResult}</p>}
          </div>
        </div>
      )}

      {/* StoryComposer modal (shown when map is clicked) */}
      {showMapPost && mapClickedPos && (
        <StoryComposer
          handle={user.handle}
          token={token}
          initialCoords={mapClickedPos}
          mapPinMode
          onClose={() => {
            setShowMapPost(false);
            setMapClickedPos(null);
            if (mapPinMarkerRef.current && mapInstanceRef.current) {
              mapInstanceRef.current.removeLayer(mapPinMarkerRef.current);
              mapPinMarkerRef.current = null;
            }
          }}
          onPosted={() => loadMapSecrets()}
        />
      )}

      {/* Recent secrets list */}
      {visibleMapSecrets.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-3">
            Recent drops{mapCityFilter ? ` in ${mapCityFilter}` : ""}
          </h3>
          <div className="space-y-2">
            {visibleMapSecrets.slice(0, 10).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSelectedMapSecret(s);
                  setMapSecretRevealed(false);
                  setShowMapPost(false);
                  setMapReportOpen(false);
                  setMapReportResult(null);
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.setView([s.lat, s.lng], 14);
                  }
                }}
                className="w-full flex items-center gap-3 bg-surface-raised rounded-xl border border-border p-3 hover:border-accent/50 transition-colors text-left"
              >
                <span className="text-lg">{s.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-muted italic">Tap to reveal</p>
                  <p className="text-xs text-text-muted">
                    {s.handle && `@${s.handle} · `}
                    {(s.cityName || s.locationName) && `${s.cityName || s.locationName} · `}
                    ⏳ {mapTimeRemaining(s.expiresAt)}
                  </p>
                </div>
                <span className="text-xs text-accent">👁️</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
