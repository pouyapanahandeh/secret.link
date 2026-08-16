import { Link } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { getApiBase } from "../../lib/api.client";

function LandingMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const pinMarkerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDropForm, setShowDropForm] = useState(false);
  const [clickedPos, setClickedPos] = useState<{ lat: number; lng: number } | null>(null);
  const [message, setMessage] = useState("");
  const [emoji, setEmoji] = useState("💬");
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [selectedSecret, setSelectedSecret] = useState<any>(null);
  const [secretRevealed, setSecretRevealed] = useState(false);
  const [revealCountdown, setRevealCountdown] = useState<number | null>(null);
  const revealTimerRef = useRef<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [revealMode, setRevealMode] = useState<"timer" | "clicks">("timer");
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [maxClicks, setMaxClicks] = useState(3);

  function placePin(lat: number, lng: number) {
    const L = (window as any).L;
    const map = mapRef.current;
    if (!L || !map) return;
    if (pinMarkerRef.current) map.removeLayer(pinMarkerRef.current);
    const icon = L.divIcon({
      html: '<div style="font-size:28px;text-align:center;line-height:34px;">📍</div>',
      className: "",
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    });
    pinMarkerRef.current = L.marker([lat, lng], { icon }).addTo(map);
  }

  useEffect(() => {
    if (mapRef.current) return;

    let cancelled = false;

    import("../../lib/leaflet.client").then(({ loadLeaflet }) =>
      loadLeaflet()
    ).then((L) => {
      if (cancelled || !mapContainerRef.current || mapRef.current) return;

      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([51.505, -0.09], 3);
      mapRef.current = map;

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
          () => {}
        );
      }

      map.on("click", (e: any) => {
        const pos = { lat: e.latlng.lat, lng: e.latlng.lng };
        setClickedPos(pos);
        setShowDropForm(true);
        setSelectedSecret(null);
        setSecretRevealed(false);
        setPosted(false);
        if (pinMarkerRef.current) map.removeLayer(pinMarkerRef.current);
        const icon = L.divIcon({
          html: '<div style="font-size:28px;text-align:center;line-height:34px;">📍</div>',
          className: "",
          iconSize: [34, 34],
          iconAnchor: [17, 34],
        });
        pinMarkerRef.current = L.marker([pos.lat, pos.lng], { icon }).addTo(map);
      });

      loadSecrets(map, L);
    });

    return () => { cancelled = true; };
  }, []);

  async function loadSecrets(map?: any, leaflet?: any) {
    const m = map || mapRef.current;
    const L = leaflet || (window as any).L;
    if (!L || !m) return;
    try {
      const res = await fetch(`${getApiBase()}/v1/secrets/map`);
      if (!res.ok) return;
      const data = await res.json();
      m.eachLayer((layer: any) => { if (layer._isSecretMarker) m.removeLayer(layer); });
      data.forEach((s: any) => {
        const icon = L.divIcon({
          html: `<div style="font-size:24px;text-align:center;line-height:30px;">${s.emoji || "💬"}</div>`,
          className: "",
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        const marker = L.marker([s.lat, s.lng], { icon }).addTo(m);
        marker._isSecretMarker = true;
        marker.on("click", () => {
          setSelectedSecret(s);
          setSecretRevealed(false);
          setShowDropForm(false);
          setRevealCountdown(null);
          if (revealTimerRef.current) clearInterval(revealTimerRef.current);
          if (pinMarkerRef.current) { m.removeLayer(pinMarkerRef.current); pinMarkerRef.current = null; }
        });
      });
    } catch {}
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (f.type.startsWith("image/") || f.type.startsWith("video/")) {
      setFilePreview(URL.createObjectURL(f));
    } else {
      setFilePreview(null);
    }
  }

  async function handleDrop() {
    if (!clickedPos) return;
    if (!message.trim() && !file) return;
    setPosting(true);
    try {
      let mediaPath: string | null = null;
      let mediaType: string | null = null;

      if (file) {
        const arrayBuf = await file.arrayBuffer();
        const uploadRes = await fetch(`${getApiBase()}/v1/secrets/blob`, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: arrayBuf,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          mediaPath = uploadData.blobPath;
          if (file.type.startsWith("image/")) mediaType = "image";
          else if (file.type.startsWith("video/")) mediaType = "video";
          else mediaType = "file";
        }
      }

      const { encryptMapMessage } = await import("../../lib/crypto");
      const encrypted = await encryptMapMessage(
        message.trim() || (file ? `[${mediaType ?? "file"}]` : ""),
      );
      const res = await fetch(`${getApiBase()}/v1/secrets/map`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...encrypted,
          lat: clickedPos.lat,
          lng: clickedPos.lng,
          emoji,
          ttlMinutes: 60,
          revealMode,
          revealTimerSeconds: revealMode === "timer" ? timerSeconds : 30,
          maxClicks: revealMode === "clicks" ? maxClicks : 0,
          ...(mediaPath ? { mediaPath, mediaType: mediaType ?? undefined } : {}),
        }),
      });
      if (res.ok) {
        setPosted(true);
        setMessage("");
        setFile(null);
        setFilePreview(null);
        setShowDropForm(false);
        if (pinMarkerRef.current && mapRef.current) {
          mapRef.current.removeLayer(pinMarkerRef.current);
          pinMarkerRef.current = null;
        }
        loadSecrets();
      }
    } catch {}
    setPosting(false);
  }

  async function handleReveal() {
    if (!selectedSecret) return;
    try {
      const res = await fetch(`${getApiBase()}/v1/secrets/map/${selectedSecret.id}/reveal`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "limit_reached") {
          setSelectedSecret({ ...selectedSecret, _limitReached: true });
          setSecretRevealed(true);
        }
        return;
      }
      const { decryptMapReveal } = await import("../../lib/crypto");
      const plaintext = await decryptMapReveal(data);
      setSelectedSecret({ ...selectedSecret, ...data, message: plaintext });
      setSecretRevealed(true);
      const mode = data.reveal_mode || data.revealMode || "timer";
      if (mode === "timer") {
        const secs = data.reveal_timer_seconds ?? data.revealTimerSeconds ?? 30;
        setRevealCountdown(secs);
        if (revealTimerRef.current) clearInterval(revealTimerRef.current);
        revealTimerRef.current = setInterval(() => {
          setRevealCountdown((prev) => {
            if (prev === null || prev <= 1) {
              clearInterval(revealTimerRef.current);
              setSecretRevealed(false);
              setSelectedSecret(null);
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch {}
  }

  const emojis = ["💬", "🔥", "❤️", "😈", "🤫", "💀", "👀", "✨"];

  return (
    <div className="space-y-4">
      <div className="relative rounded-sm border border-border overflow-hidden h-[min(55dvh,360px)] sm:h-[450px]">
        <div ref={mapContainerRef} className="w-full h-full" />
        <button
          onClick={() => {
            if (mapRef.current) {
              const center = mapRef.current.getCenter();
              setClickedPos({ lat: center.lat, lng: center.lng });
              placePin(center.lat, center.lng);
              setShowDropForm(true);
              setSelectedSecret(null);
              setPosted(false);
            }
          }}
          className="absolute bottom-3 left-3 right-16 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-40 min-h-11 rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-black shadow-lg shadow-accent/25 hover:scale-[1.03] transition-all"
        >
          Drop story 📍
        </button>
        <button
          onClick={() => {
            if (navigator.geolocation && mapRef.current) {
              navigator.geolocation.getCurrentPosition(
                (pos) => mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 15),
                () => {}
              );
            }
          }}
          className="absolute bottom-3 right-3 z-40 w-11 h-11 rounded-full bg-surface-raised border border-border shadow-lg flex items-center justify-center hover:border-accent/50 transition-colors"
          aria-label="Locate me"
        >
          <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.364-6.364l-1.414 1.414M7.05 16.95l-1.414 1.414m12.728 0l-1.414-1.414M7.05 7.05L5.636 5.636M12 8a4 4 0 100 8 4 4 0 000-8z" />
          </svg>
        </button>
      </div>

      {showDropForm && (
        <div className="bg-surface-raised rounded-xl border border-border p-4 text-left">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Add a story here</h3>
            <button onClick={() => { setShowDropForm(false); if (pinMarkerRef.current && mapRef.current) { mapRef.current.removeLayer(pinMarkerRef.current); pinMarkerRef.current = null; } }} className="text-text-muted hover:text-text text-lg">×</button>
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What's your story?"
            maxLength={500}
            className="w-full bg-surface border border-border rounded-lg p-3 text-sm text-text placeholder:text-text-muted resize-none focus:outline-none focus:border-accent/50"
            rows={3}
          />

          <div className="mt-3">
            <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.zip,.txt" onChange={handleFileChange} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-text-muted hover:text-accent border border-border rounded-lg px-3 py-1.5 transition-colors"
            >
              📎 Attach file, image or video
            </button>
            {file && (
              <div className="mt-2 flex items-center gap-2">
                {filePreview && file.type.startsWith("image/") && (
                  <img src={filePreview} alt="preview" className="w-12 h-12 rounded-lg object-cover" />
                )}
                {filePreview && file.type.startsWith("video/") && (
                  <video src={filePreview} className="w-12 h-12 rounded-lg object-cover" />
                )}
                <span className="text-xs text-text-muted truncate flex-1">{file.name}</span>
                <button onClick={() => { setFile(null); setFilePreview(null); }} className="text-xs text-red-400 hover:text-red-300">✕</button>
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wide block mb-1">Reveal mode</label>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setRevealMode("timer")}
                  className={`flex-1 min-h-11 sm:min-h-0 py-1.5 text-xs font-medium transition-colors ${revealMode === "timer" ? "bg-accent text-black" : "text-text-muted hover:text-text"}`}
                >
                  ⏱️ Timer
                </button>
                <button
                  onClick={() => setRevealMode("clicks")}
                  className={`flex-1 min-h-11 sm:min-h-0 py-1.5 text-xs font-medium transition-colors ${revealMode === "clicks" ? "bg-accent text-black" : "text-text-muted hover:text-text"}`}
                >
                  👆 Clicks
                </button>
              </div>
            </div>
            <div>
              {revealMode === "timer" ? (
                <>
                  <label className="text-[10px] text-text-muted uppercase tracking-wide block mb-1">View time</label>
                  <select
                    value={timerSeconds}
                    onChange={(e) => setTimerSeconds(Number(e.target.value))}
                    className="w-full min-h-11 sm:min-h-0 bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text"
                  >
                    <option value={10}>10 seconds</option>
                    <option value={30}>30 seconds</option>
                    <option value={60}>1 minute</option>
                    <option value={120}>2 minutes</option>
                  </select>
                </>
              ) : (
                <>
                  <label className="text-[10px] text-text-muted uppercase tracking-wide block mb-1">Max reveals</label>
                  <select
                    value={maxClicks}
                    onChange={(e) => setMaxClicks(Number(e.target.value))}
                    className="w-full min-h-11 sm:min-h-0 bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text"
                  >
                    <option value={1}>1 reveal</option>
                    <option value={3}>3 reveals</option>
                    <option value={5}>5 reveals</option>
                    <option value={10}>10 reveals</option>
                    <option value={25}>25 reveals</option>
                  </select>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
            <div className="flex flex-wrap gap-1">
              {emojis.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`w-11 h-11 sm:w-7 sm:h-7 rounded-lg text-base flex items-center justify-center transition-all ${emoji === e ? "bg-accent/20 scale-110" : "hover:bg-surface"}`}
                >
                  {e}
                </button>
              ))}
            </div>
            <button
              onClick={handleDrop}
              disabled={(!message.trim() && !file) || posting}
              className="min-h-11 rounded-full bg-accent px-5 py-2 text-sm font-bold text-black hover:scale-[1.03] transition-all disabled:opacity-50"
            >
              {posting ? "Sharing..." : "Share story 📍"}
            </button>
          </div>
        </div>
      )}

      {posted && !showDropForm && (
        <div className="bg-surface-raised rounded-xl border border-border p-4 text-center">
          <span className="text-2xl block mb-2">✓</span>
          <p className="text-sm font-medium">Story shared!</p>
          <p className="text-xs text-text-muted mt-1">It will expire in 1 hour</p>
        </div>
      )}

      {selectedSecret && (
        <div className="bg-surface-raised rounded-xl border border-border p-4 text-left relative">
          <button
            onClick={() => { setSelectedSecret(null); setSecretRevealed(false); setRevealCountdown(null); if (revealTimerRef.current) clearInterval(revealTimerRef.current); }}
            className="absolute top-2 right-3 text-text-muted hover:text-text text-lg"
          >×</button>

          {!secretRevealed ? (
            <div className="text-center py-4">
              <span className="text-4xl block mb-3">{selectedSecret.emoji}</span>
              <p className="text-sm text-text-muted mb-1">
                {selectedSecret.handle ? `@${selectedSecret.handle}` : "Someone"} shared a story
              </p>
              <button
                onClick={handleReveal}
                className="mt-3 rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-black hover:scale-[1.03] transition-all"
              >
                Tap to reveal 👁️
              </button>
            </div>
          ) : selectedSecret._limitReached ? (
            <div className="text-center py-4">
              <span className="text-3xl block mb-2">🚫</span>
              <p className="text-sm text-text-muted">No more reveals available</p>
            </div>
          ) : (
            <div>
              {revealCountdown !== null && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-1000"
                      style={{ width: `${(revealCountdown / (selectedSecret.reveal_timer_seconds ?? selectedSecret.revealTimerSeconds ?? 30)) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-accent font-mono">{revealCountdown}s</span>
                </div>
              )}
              <p className="text-sm text-text whitespace-pre-wrap">{selectedSecret.message}</p>
              {selectedSecret.media_path && (
                <div className="mt-3">
                  {(selectedSecret.media_type === "image" || selectedSecret.media_type?.startsWith("image/")) && (
                    <img src={`${getApiBase()}/v1/secrets/blob/${selectedSecret.media_path}`} alt="secret" className="w-full rounded-lg max-h-48 object-contain" />
                  )}
                  {(selectedSecret.media_type === "video" || selectedSecret.media_type?.startsWith("video/")) && (
                    <video src={`${getApiBase()}/v1/secrets/blob/${selectedSecret.media_path}`} controls className="w-full rounded-lg max-h-48" />
                  )}
                  {selectedSecret.media_type === "file" && (
                    <a href={`${getApiBase()}/v1/secrets/blob/${selectedSecret.media_path}`} download className="text-xs text-accent hover:underline">📎 Download file</a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MapSection() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-black">
                <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                Live
              </span>
              <span className="text-2xl">🗺️</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Explore stories on the map</h2>
          </div>
          <p className="text-text-muted max-w-sm sm:text-right">
            People are sharing geo-tagged stories near you right now. Tap anywhere to add yours.
          </p>
        </div>
        <LandingMap />
      </div>
    </section>
  );
}

export function FinalCtaSection() {
  return (
    <section className="bg-accent text-black">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <p className="text-5xl mb-4">🤫</p>
        <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[0.95] max-w-3xl">
          Ready for your anonymous inbox?
        </h2>
        <p className="mt-4 text-lg text-black/70 max-w-md">
          Claim a handle. Share the link. Secrets come to you.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Link
            to="/signup"
            className="inline-flex items-center justify-center min-h-12 w-full sm:w-auto rounded-full bg-black px-8 text-sm font-extrabold text-accent hover:opacity-90 transition-opacity"
          >
            Get your @handle
          </Link>
          <Link
            to="/send"
            className="inline-flex items-center justify-center min-h-12 w-full sm:w-auto text-sm font-semibold text-black/80 hover:text-black underline underline-offset-4"
          >
            Or send a one-time secret →
          </Link>
        </div>
      </div>
    </section>
  );
}
