import { useEffect, useRef, useState } from "react";
import { getApiBase } from "../lib/api.client";
import { reverseGeocode, searchLocations, cityFromResult, type GeocodeResult } from "../lib/geocode";

interface StoryComposerProps {
  /** Current user's handle — stamped on the story so it shows in the row. */
  handle: string;
  onClose: () => void;
  /** Called after a story is posted (so the dashboard can refresh). */
  onPosted?: () => void;
}

const EMOJIS = ["💬", "❤️", "🔥", "👀", "🤫", "💀", "🎉", "😂"];

/**
 * Quick "add to your story" composer. Captures the user's current location
 * automatically and drops an ephemeral map secret there — no map interaction
 * needed (that's what the dedicated "Pin on map" flow is for).
 */
export function StoryComposer({ handle, onClose, onPosted }: StoryComposerProps) {
  const [message, setMessage] = useState("");
  const [emoji, setEmoji] = useState("💬");
  const [ttl, setTtl] = useState(1440); // stories default to 24h
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const [locationName, setLocationName] = useState<string>("");
  const [cityName, setCityName] = useState<string>("");
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<GeocodeResult[]>([]);
  const [searchingLocations, setSearchingLocations] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Resolve the current location on mount.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocating(false);
      setError("Location isn't available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        reverseGeocode(pos.coords.latitude, pos.coords.longitude).then((g) => {
          if (!g) return;
          setLocationName(g.locationName);
          setCityName(g.cityName ?? "");
        }).catch(() => {});
      },
      () => {
        setLocating(false);
        setError("Allow location access to post a story.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  // Revoke object URLs to avoid leaks.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Search places by query so users can pin stories to a chosen location.
  useEffect(() => {
    const q = locationQuery.trim();
    if (q.length < 2) {
      setLocationResults([]);
      setSearchingLocations(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingLocations(true);
      const results = await searchLocations(q);
      setLocationResults(results);
      setSearchingLocations(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [locationQuery]);

  function selectFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (f.type.startsWith("image/") || f.type.startsWith("video/")) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  }

  function clearFile() {
    setFile(null);
    setPreview(null);
  }

  async function post() {
    if (!coords || !message.trim() || posting) return;
    setPosting(true);
    setError(null);
    try {
      let mediaPath: string | null = null;
      let mediaType: string | null = null;

      if (file) {
        const up = await fetch(`${getApiBase()}/v1/secrets/blob`, { method: "POST", body: file });
        if (up.ok) {
          const d = await up.json();
          mediaPath = d.blobPath;
          mediaType = file.type;
        }
      }

      const res = await fetch(`${getApiBase()}/v1/secrets/map`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          lat: coords.lat,
          lng: coords.lng,
          emoji,
          ttlMinutes: ttl,
          handle,
          locationName: locationName || undefined,
          cityName: cityName || undefined,
          mediaPath,
          mediaType,
          revealMode: "timer",
          revealTimerSeconds: 15,
        }),
      });

      if (res.ok) {
        onPosted?.();
        onClose();
      } else {
        setError("Couldn't post your story. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  const canPost = !!coords && !!message.trim() && !posting;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-surface-raised rounded-t-3xl sm:rounded-3xl border border-border p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">Add to your story</h3>
          <button onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text text-xl leading-none px-1">
            ×
          </button>
        </div>

        {/* Location status */}
        <div className="mb-3 flex items-center gap-2 text-xs">
          <span>📍</span>
          {locating ? (
            <span className="text-text-muted">Finding your location…</span>
          ) : coords ? (
            <span className="text-text-muted truncate">
              {locationName ? `Posting at ${locationName}` : "Posting at your current location"}
            </span>
          ) : (
            <span className="text-red-400">Location needed</span>
          )}
        </div>

        {/* Location search */}
        <div className="mb-3">
          <input
            type="text"
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
            placeholder="Search city or place (optional)"
            className="w-full rounded-xl bg-surface border border-border px-3 py-2 text-xs text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          {searchingLocations && <p className="text-[11px] text-text-muted mt-1">Searching…</p>}
          {locationResults.length > 0 && (
            <div className="mt-2 rounded-xl border border-border bg-surface max-h-40 overflow-y-auto">
              {locationResults.map((r) => (
                <button
                  key={`${r.lat},${r.lon},${r.display_name}`}
                  type="button"
                  onClick={() => {
                    const lat = Number(r.lat);
                    const lng = Number(r.lon);
                    if (Number.isFinite(lat) && Number.isFinite(lng)) {
                      setCoords({ lat, lng });
                      setLocationName(r.display_name);
                      setCityName(cityFromResult(r));
                    }
                    setLocationQuery(r.display_name);
                    setLocationResults([]);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-surface-raised border-b border-border/50 last:border-b-0 truncate"
                >
                  {r.display_name}
                </button>
              ))}
            </div>
          )}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Share something…"
          className="w-full rounded-xl bg-surface border border-border px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
        />

        {/* Media preview */}
        {preview && file && (
          <div className="mt-2 relative inline-block">
            {file.type.startsWith("image/") ? (
              <img src={preview} alt="preview" className="max-h-32 rounded-lg border border-border" />
            ) : file.type.startsWith("video/") ? (
              <video src={preview} className="max-h-32 rounded-lg border border-border" controls />
            ) : null}
            <button
              onClick={clearFile}
              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
            >
              ×
            </button>
          </div>
        )}

        {/* Attach + emoji row */}
        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={selectFile} />
        <div className="flex items-center gap-1.5 mt-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1 text-xs text-text-muted bg-surface border border-border rounded-lg px-2 py-1.5 hover:border-accent/50 transition-colors"
          >
            📸 Photo / video
          </button>
          <div className="flex-1" />
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-all ${
                emoji === e ? "bg-accent/20 scale-110 ring-1 ring-accent" : "hover:bg-surface"
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        {/* Expiry */}
        <div className="mt-3">
          <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Story expires</label>
          <select
            value={ttl}
            onChange={(e) => setTtl(Number(e.target.value))}
            className="w-full text-xs bg-surface border border-border rounded-lg px-2 py-1.5 text-text"
          >
            <option value={60}>1 hour</option>
            <option value={360}>6 hours</option>
            <option value={720}>12 hours</option>
            <option value={1440}>24 hours</option>
          </select>
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <button
          onClick={post}
          disabled={!canPost}
          className="w-full mt-4 rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-black hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100"
        >
          {posting ? "Posting…" : "Share story ✨"}
        </button>
      </div>
    </div>
  );
}
