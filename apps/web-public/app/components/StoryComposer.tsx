import { useEffect, useRef, useState } from "react";
import { getApiBase } from "../lib/api.client";
import { reverseGeocode, searchLocations, cityFromResult, type GeocodeResult } from "../lib/geocode";
import { FullScreenCamera } from "./FullScreenCamera";

interface StoryComposerProps {
  /** Current user's handle — stamped on the story so it shows in the row. */
  handle: string;
  /** JWT token for authenticated map posts. */
  token: string;
  onClose: () => void;
  /** Called after a story is posted (so the dashboard can refresh). */
  onPosted?: () => void;
}

const EMOJIS = ["💬", "❤️", "🔥", "👀", "🤫", "💀", "🎉", "😂"];
const TTL_OPTIONS = [
  { value: 60, label: "1 hour" },
  { value: 360, label: "6 hours" },
  { value: 720, label: "12 hours" },
  { value: 1440, label: "24 hours" },
];

type Step = "media" | "compose" | "confirm";

/**
 * Multi-step story composer with full-screen camera support.
 * Step 1: Media capture/selection (camera or gallery)
 * Step 2: Message composition + settings
 * Step 3: Preview & confirm
 */
export function StoryComposer({ handle, token, onClose, onPosted }: StoryComposerProps) {
  const [step, setStep] = useState<Step>("media");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const [message, setMessage] = useState("");
  const [emoji, setEmoji] = useState("💬");
  const [ttl, setTtl] = useState(1440);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const [locationName, setLocationName] = useState("");
  const [cityName, setCityName] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<GeocodeResult[]>([]);
  const [searchingLocations, setSearchingLocations] = useState(false);

  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // Resolve geolocation on mount.
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

  // Search places by query.
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

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileAndPreview(f);
    setStep("compose");
  }

  function setFileAndPreview(f: File) {
    setFile(f);
    if (f.type.startsWith("image/") || f.type.startsWith("video/")) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  }

  function clearFile() {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  }

  function handleCameraCapture(capturedFile: File) {
    setShowCamera(false);
    setFileAndPreview(capturedFile);
    setStep("compose");
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Couldn't post your story. Please try again.");
        setStep("compose");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setStep("compose");
    } finally {
      setPosting(false);
    }
  }

  // ─── Full-Screen Camera ─────────────────────────────────────────────────────
  if (showCamera) {
    return <FullScreenCamera onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />;
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-surface-raised rounded-t-3xl sm:rounded-3xl border border-border max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with step indicators */}
        <div className="px-5 pt-5 pb-3 border-b border-border/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold">
              {step === "media" && "Add to your story"}
              {step === "compose" && "Write your story"}
              {step === "confirm" && "Preview"}
            </h3>
            <button onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text text-xl leading-none px-1">
              ×
            </button>
          </div>
          {/* Progress dots */}
          <div className="flex items-center gap-2 justify-center">
            {(["media", "compose", "confirm"] as Step[]).map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step ? "w-8 bg-accent" : "w-3 bg-border"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* ─── STEP 1: MEDIA ─── */}
          {step === "media" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-text-muted text-center">Capture or select media for your story</p>

              {/* Camera action */}
              <button
                onClick={() => setShowCamera(true)}
                className="flex items-center gap-4 p-5 rounded-2xl border-2 border-dashed border-accent/40 bg-accent/5 hover:border-accent hover:bg-accent/10 transition-all group"
              >
                <span className="w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  📸
                </span>
                <div className="text-left">
                  <span className="text-sm font-semibold text-text block">Open Camera</span>
                  <span className="text-xs text-text-muted">Take a photo or record a video</span>
                </div>
              </button>

              {/* Gallery action */}
              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-4 p-5 rounded-2xl border-2 border-dashed border-border hover:border-accent/50 hover:bg-surface transition-all group"
              >
                <span className="w-14 h-14 rounded-full bg-surface flex items-center justify-center text-2xl border border-border group-hover:scale-110 transition-transform">
                  🖼️
                </span>
                <div className="text-left">
                  <span className="text-sm font-semibold text-text block">Choose from Gallery</span>
                  <span className="text-xs text-text-muted">Select a photo or video</span>
                </div>
              </button>

              {/* Skip media */}
              <button
                onClick={() => setStep("compose")}
                className="text-sm text-text-muted hover:text-accent transition-colors text-center mt-2"
              >
                Skip — text only →
              </button>
            </div>
          )}

          {/* ─── STEP 2: COMPOSE ─── */}
          {step === "compose" && (
            <div className="flex flex-col gap-4">
              {/* Media preview */}
              {preview && file && (
                <div className="relative rounded-2xl overflow-hidden border border-border">
                  {file.type.startsWith("image/") ? (
                    <img src={preview} alt="preview" className="w-full max-h-48 object-cover" />
                  ) : file.type.startsWith("video/") ? (
                    <video src={preview} className="w-full max-h-48 object-cover" controls />
                  ) : null}
                  <button
                    onClick={() => { clearFile(); setStep("media"); }}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 backdrop-blur-sm text-white rounded-full text-sm flex items-center justify-center hover:bg-red-500 transition-colors"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Location status */}
              <div className="flex items-center gap-2 text-xs bg-surface rounded-xl border border-border px-3 py-2.5">
                <span>📍</span>
                {locating ? (
                  <span className="text-text-muted">Finding your location…</span>
                ) : coords ? (
                  <span className="text-text-muted truncate">
                    {locationName ? locationName : "Your current location"}
                  </span>
                ) : (
                  <span className="text-red-400">Location needed</span>
                )}
              </div>

              {/* Location search */}
              <div>
                <input
                  type="text"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder="Search city or place (optional)"
                  className="w-full rounded-xl bg-surface border border-border px-3 py-2.5 text-xs text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                {searchingLocations && <p className="text-[11px] text-text-muted mt-1 px-1">Searching…</p>}
                {locationResults.length > 0 && (
                  <div className="mt-2 rounded-xl border border-border bg-surface max-h-32 overflow-y-auto">
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

              {/* Message */}
              <div className="relative">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Share something…"
                  className="w-full rounded-xl bg-surface border border-border px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                />
                <span className="absolute bottom-2 right-3 text-[10px] text-text-muted">
                  {message.length}/500
                </span>
              </div>

              {/* Emoji selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-text-muted mr-1">Emoji:</span>
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
                      emoji === e ? "bg-accent/20 scale-110 ring-2 ring-accent" : "hover:bg-surface border border-border"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>

              {/* TTL selection as cards */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-2">Story expires in</label>
                <div className="grid grid-cols-4 gap-2">
                  {TTL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setTtl(opt.value)}
                      className={`rounded-xl px-2 py-2.5 text-xs font-medium border transition-all ${
                        ttl === opt.value
                          ? "bg-accent/15 border-accent text-accent"
                          : "bg-surface border-border text-text-muted hover:border-accent/40"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              {/* Actions */}
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setStep("media")}
                  className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm text-text-muted hover:text-text hover:border-accent/50 transition-all"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep("confirm")}
                  disabled={!message.trim() || !coords}
                  className="flex-1 rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-black hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100"
                >
                  Preview →
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP 3: CONFIRM ─── */}
          {step === "confirm" && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-text-muted text-center">Here's how your story will appear</p>

              {/* Preview card */}
              <div className="rounded-2xl border border-border bg-surface p-4">
                {preview && file && (
                  <div className="rounded-xl overflow-hidden mb-3">
                    {file.type.startsWith("image/") ? (
                      <img src={preview} alt="preview" className="w-full max-h-40 object-cover" />
                    ) : file.type.startsWith("video/") ? (
                      <video src={preview} className="w-full max-h-40 object-cover" controls />
                    ) : null}
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text leading-relaxed break-words whitespace-pre-wrap">{message}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-xs text-accent">@{handle}</span>
                      {locationName && (
                        <span className="text-xs text-text-muted">📍 {locationName}</span>
                      )}
                      <span className="text-xs text-text-muted">
                        ⏳ {TTL_OPTIONS.find((o) => o.value === ttl)?.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep("compose")}
                  className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm text-text-muted hover:text-text hover:border-accent/50 transition-all"
                >
                  ← Edit
                </button>
                <button
                  onClick={post}
                  disabled={posting || !coords || !message.trim()}
                  className="flex-1 rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-black hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100"
                >
                  {posting ? "Posting…" : "Share story ✨"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
