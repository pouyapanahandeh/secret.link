import type { MetaFunction } from "@remix-run/node";
import { useEffect, useState, useRef } from "react";
import { ThemeToggle } from "../components/ThemeToggle";

export const meta: MetaFunction = () => [
  { title: "Secret Map — Secretlink.life" },
  { name: "description", content: "Drop anonymous secrets on the map. They disappear after time." },
];

interface MapSecret {
  id: string;
  message: string;
  lat: number;
  lng: number;
  emoji: string;
  createdAt: string;
  expiresAt: string;
  handle?: string;
}

export default function MapPage() {
  const [secrets, setSecrets] = useState<MapSecret[]>([]);
  const [selectedSecret, setSelectedSecret] = useState<MapSecret | null>(null);
  const [showPost, setShowPost] = useState(false);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState("");
  const [emoji, setEmoji] = useState("💬");
  const [ttl, setTtl] = useState(60);
  const [clickedPos, setClickedPos] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Leaflet dynamically (client-only)
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => initMap();
    document.head.appendChild(script);

    return () => {
      if (mapRef.current) mapRef.current.remove();
    };
  }, []);

  function initMap() {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current).setView([51.505, -0.09], 3);
    mapRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(map);

    // Try to get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 13),
        () => {} // ignore error
      );
    }

    // Click to place secret
    map.on("click", (e: any) => {
      setClickedPos({ lat: e.latlng.lat, lng: e.latlng.lng });
      setShowPost(true);
      setSelectedSecret(null);
    });

    // Load existing secrets
    loadSecrets(map);
  }

  async function loadSecrets(map?: any) {
    const m = map || mapRef.current;
    const L = (window as any).L;
    if (!L || !m) return;

    const origin = window.location.origin;
    const apiBase = window.location.port === "3000" ? origin.replace(":3000", ":4000") : origin;

    try {
      const res = await fetch(`${apiBase}/v1/secrets/map`);
      if (!res.ok) return;
      const data: MapSecret[] = await res.json();
      setSecrets(data);

      // Clear old markers and add new
      m.eachLayer((layer: any) => {
        if (layer._isSecretMarker) m.removeLayer(layer);
      });

      data.forEach((s) => {
        const icon = L.divIcon({
          className: "secret-marker",
          html: `<div style="font-size:24px;cursor:pointer;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">${s.emoji}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

        const marker = L.marker([s.lat, s.lng], { icon }).addTo(m);
        marker._isSecretMarker = true;
        marker.on("click", () => {
          setSelectedSecret(s);
          setShowPost(false);
        });
      });
    } catch (err) {
      // silently fail
    }
  }

  async function postSecret() {
    if (!clickedPos || !message.trim()) return;
    setPosting(true);

    const origin = window.location.origin;
    const apiBase = window.location.port === "3000" ? origin.replace(":3000", ":4000") : origin;

    try {
      const res = await fetch(`${apiBase}/v1/secrets/map`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          lat: clickedPos.lat,
          lng: clickedPos.lng,
          emoji,
          ttlMinutes: ttl,
        }),
      });

      if (res.ok) {
        setMessage("");
        setShowPost(false);
        setClickedPos(null);
        loadSecrets();
      }
    } catch (err) {
      // silently fail
    } finally {
      setPosting(false);
    }
  }

  function timeRemaining(expiresAt: string) {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return "Expired";
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m left`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m left`;
  }

  return (
    <main className="h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-4 sm:px-6 py-3 bg-surface border-b border-border/50 z-20 relative">
        <a href="/" className="flex items-center gap-2">
          <img src="/secretlink.png" alt="Secretlink.life" className="w-7 h-7" />
          <span className="text-lg font-bold tracking-tight">
            secretlink<span className="text-accent">.</span>life
          </span>
        </a>
        <div className="flex items-center gap-3">
          <span className="text-sm text-accent font-semibold">🗺️ Secret Map</span>
          <ThemeToggle />
        </div>
      </nav>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Instruction overlay */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-surface/90 backdrop-blur-md border border-border rounded-full px-4 py-2 text-xs text-text-muted pointer-events-none">
          Tap anywhere on the map to drop a secret
        </div>

        {/* Selected secret popup */}
        {selectedSecret && (
          <div className="absolute bottom-6 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-sm z-[1000] bg-surface rounded-2xl border border-border p-5 shadow-xl">
            <button
              onClick={() => setSelectedSecret(null)}
              className="absolute top-3 right-3 text-text-muted hover:text-text text-lg"
            >
              ×
            </button>
            <div className="flex items-start gap-3">
              <span className="text-2xl">{selectedSecret.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-text text-sm leading-relaxed break-words">{selectedSecret.message}</p>
                <div className="flex items-center gap-2 mt-2">
                  {selectedSecret.handle && (
                    <a href={`/${selectedSecret.handle}`} className="text-xs text-accent hover:text-accent-soft">
                      @{selectedSecret.handle}
                    </a>
                  )}
                  <span className="text-xs text-text-muted">
                    ⏳ {timeRemaining(selectedSecret.expiresAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Post secret form */}
        {showPost && clickedPos && (
          <div className="absolute bottom-6 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-sm z-[1000] bg-surface rounded-2xl border border-border p-5 shadow-xl">
            <button
              onClick={() => { setShowPost(false); setClickedPos(null); }}
              className="absolute top-3 right-3 text-text-muted hover:text-text text-lg"
            >
              ×
            </button>
            <h3 className="text-sm font-semibold mb-3">Drop a secret here</h3>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Write your secret..."
              className="w-full rounded-xl bg-surface-raised border border-border px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
            />

            <div className="flex items-center gap-3 mt-3">
              {/* Emoji picker */}
              <div className="flex gap-1">
                {["💬", "❤️", "🔥", "👀", "🤫", "💀"].map((e) => (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
                      emoji === e ? "bg-accent/20 scale-110" : "hover:bg-surface-raised"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>

              {/* TTL */}
              <select
                value={ttl}
                onChange={(e) => setTtl(Number(e.target.value))}
                className="text-xs bg-surface-raised border border-border rounded-lg px-2 py-1.5 text-text"
              >
                <option value={5}>5 min</option>
                <option value={30}>30 min</option>
                <option value={60}>1 hour</option>
                <option value={360}>6 hours</option>
                <option value={1440}>24 hours</option>
              </select>
            </div>

            <button
              onClick={postSecret}
              disabled={posting || !message.trim()}
              className="w-full mt-4 rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-black hover:scale-[1.02] transition-all disabled:opacity-50"
            >
              {posting ? "Dropping..." : "Drop secret 📍"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
