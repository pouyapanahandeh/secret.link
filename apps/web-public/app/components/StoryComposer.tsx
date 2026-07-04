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
  /** Pre-set coordinates (e.g. from map click). Skips geolocation if provided. */
  initialCoords?: { lat: number; lng: number } | null;
  /** If true, show anonymity toggle and additional map-pin options. */
  mapPinMode?: boolean;
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
export function StoryComposer({ handle, token, onClose, onPosted, initialCoords, mapPinMode }: StoryComposerProps) {
  const [step, setStep] = useState<Step>("media");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const [message, setMessage] = useState("");
  const [emoji, setEmoji] = useState("💬");
  const [ttl, setTtl] = useState(mapPinMode ? 60 : 1440);
  const [anonymous, setAnonymous] = useState(false);
  const [revealMode, setRevealMode] = useState<"timer" | "clicks">("timer");
  const [revealTimer, setRevealTimer] = useState(30);
  const [maxClicks, setMaxClicks] = useState(3);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(initialCoords ?? null);
  const [locating, setLocating] = useState(!initialCoords);
  const [locationName, setLocationName] = useState("");
  const [cityName, setCityName] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<GeocodeResult[]>([]);
  const [searchingLocations, setSearchingLocations] = useState(false);
  const [locationFocused, setLocationFocused] = useState(false);

  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve geolocation on mount (skip if initialCoords provided).
  useEffect(() => {
    if (initialCoords) {
      reverseGeocode(initialCoords.lat, initialCoords.lng).then((g) => {
        if (!g) return;
        setLocationName(g.locationName);
        setCityName(g.cityName ?? "");
      }).catch(() => {});
      return;
    }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocating(false);
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

  // Search places by query with debounce.
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    const q = locationQuery.trim();
    if (q.length < 3) {
      setLocationResults([]);
      setSearchingLocations(false);
      return;
    }

    setSearchingLocations(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchLocations(q);
        setLocationResults(results);
      } catch {
        setLocationResults([]);
      } finally {
        setSearchingLocations(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
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

  function selectLocation(r: GeocodeResult) {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setCoords({ lat, lng });
      setLocationName(r.display_name);
      setCityName(cityFromResult(r));
    }
    setLocationQuery(r.display_name);
    setLocationResults([]);
    setLocationFocused(false);
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

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (!anonymous) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${getApiBase()}/v1/secrets/map`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: message.trim(),
          lat: coords.lat,
          lng: coords.lng,
          emoji,
          ttlMinutes: ttl,
          handle: anonymous ? undefined : handle,
          locationName: locationName || undefined,
          cityName: cityName || undefined,
          mediaPath,
          mediaType,
          revealMode,
          revealTimerSeconds: revealMode === "timer" ? revealTimer : undefined,
          maxClicks: revealMode === "clicks" ? maxClicks : undefined,
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
              {step === "media" && (mapPinMode ? "Drop a secret" : "Add to your story")}
              {step === "compose" && "Write your message"}
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

              {/* Location section */}
              <div className="relative">
                <div className="flex items-center gap-2 text-xs bg-surface rounded-xl border border-border px-3 py-2.5">
                  <span>📍</span>
                  {locating ? (
                    <span className="text-text-muted">Finding your location…</span>
                  ) : coords ? (
                    <span className="text-text-muted truncate">
                      {locationName ? locationName : `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`}
                    </span>
                  ) : (
                    <span className="text-amber-400">Search a location below to pin your story</span>
                  )}
                </div>

                {/* Location search input */}
                <div className="mt-2 relative">
                  <input
                    type="text"
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                    onFocus={() => setLocationFocused(true)}
                    onBlur={() => setTimeout(() => setLocationFocused(false), 200)}
                    placeholder="Search location (e.g. Budapest, Times Square…)"
                    className="w-full rounded-xl bg-surface border border-border px-3 py-2.5 text-xs text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                  {searchingLocations && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* Autocomplete results dropdown */}
                {locationResults.length > 0 && locationFocused && (
                  <div className="absolute left-0 right-0 mt-1 z-10 rounded-xl border border-border bg-surface-raised shadow-lg max-h-48 overflow-y-auto">
                    {locationResults.map((r, idx) => (
                      <button
                        key={`${r.lat}-${r.lon}-${idx}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectLocation(r)}
                        className="w-full text-left px-3 py-2.5 text-xs hover:bg-accent/10 border-b border-border/30 last:border-b-0 flex items-start gap-2"
                      >
                        <span className="text-text-muted mt-0.5 shrink-0">📍</span>
                        <span className="text-text leading-tight">{r.display_name}</span>
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
                <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-2">
                  {mapPinMode ? "Pin expires in" : "Story expires in"}
                </label>
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

              {/* Reveal mode (map pin mode) */}
              {mapPinMode && (
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-2">Reveal mode</label>
                  <div className="flex rounded-xl border border-border overflow-hidden mb-2">
                    <button
                      onClick={() => setRevealMode("timer")}
                      className={`flex-1 text-xs py-2 transition-colors ${revealMode === "timer" ? "bg-accent text-black font-medium" : "bg-surface text-text-muted"}`}
                    >
                      ⏱️ Timer
                    </button>
                    <button
                      onClick={() => setRevealMode("clicks")}
                      className={`flex-1 text-xs py-2 transition-colors ${revealMode === "clicks" ? "bg-accent text-black font-medium" : "bg-surface text-text-muted"}`}
                    >
                      👆 Clicks
                    </button>
                  </div>
                  {revealMode === "timer" ? (
                    <select
                      value={revealTimer}
                      onChange={(e) => setRevealTimer(Number(e.target.value))}
                      className="w-full text-xs bg-surface border border-border rounded-lg px-2 py-1.5 text-text"
                    >
                      <option value={5}>5 seconds</option>
                      <option value={10}>10 seconds</option>
                      <option value={15}>15 seconds</option>
                      <option value={30}>30 seconds</option>
                      <option value={60}>1 minute</option>
                    </select>
                  ) : (
                    <select
                      value={maxClicks}
                      onChange={(e) => setMaxClicks(Number(e.target.value))}
                      className="w-full text-xs bg-surface border border-border rounded-lg px-2 py-1.5 text-text"
                    >
                      <option value={1}>1 reveal only</option>
                      <option value={3}>3 reveals</option>
                      <option value={5}>5 reveals</option>
                      <option value={10}>10 reveals</option>
                      <option value={25}>25 reveals</option>
                    </select>
                  )}
                </div>
              )}

              {/* Anonymity toggle (map pin mode) */}
              {mapPinMode && (
                <button
                  type="button"
                  onClick={() => setAnonymous((a) => !a)}
                  aria-pressed={anonymous}
                  className="w-full flex items-center justify-between gap-3 rounded-xl bg-surface border border-border px-3 py-2.5 text-left hover:border-accent/40 transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-base">{anonymous ? "🥷" : "👤"}</span>
                    <span className="flex flex-col min-w-0">
                      <span className="text-xs font-medium text-text truncate">
                        {anonymous ? "Posting anonymously" : `Posting as @${handle}`}
                      </span>
                      <span className="text-[10px] text-text-muted truncate">
                        {anonymous ? "Your handle won't be shown" : "Your handle will be visible"}
                      </span>
                    </span>
                  </span>
                  <span className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${anonymous ? "bg-accent" : "bg-border"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${anonymous ? "translate-x-4" : ""}`} />
                  </span>
                </button>
              )}

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
                      {!anonymous && <span className="text-xs text-accent">@{handle}</span>}
                      {anonymous && <span className="text-xs text-text-muted">🥷 Anonymous</span>}
                      {locationName && (
                        <span className="text-xs text-text-muted">📍 {locationName.split(",")[0]}</span>
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
                  {posting ? "Posting…" : mapPinMode ? "Drop secret 📍" : "Share story ✨"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
