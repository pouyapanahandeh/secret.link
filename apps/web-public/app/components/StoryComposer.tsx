import { useEffect, useRef, useState } from "react";
import { getApiBase } from "../lib/api.client";
import { reverseGeocode, searchLocations, cityFromResult, countryFromResult, type GeocodeResult } from "../lib/geocode";
import { FullScreenCamera } from "./FullScreenCamera";

interface StoryComposerProps {
  handle: string;
  token: string;
  onClose: () => void;
  onPosted?: () => void;
  initialCoords?: { lat: number; lng: number } | null;
}

const EMOJIS = ["💬", "❤️", "🔥", "👀", "🤫", "💀", "🎉", "😂"];
const TTL_OPTIONS = [
  { value: 60, label: "1 hour" },
  { value: 360, label: "6 hours" },
  { value: 720, label: "12 hours" },
  { value: 1440, label: "24 hours" },
];

type Step = "compose" | "preview";

export function StoryComposer({ handle, token, onClose, onPosted, initialCoords }: StoryComposerProps) {
  const [step, setStep] = useState<Step>("compose");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [message, setMessage] = useState("");
  const [emoji, setEmoji] = useState("💬");
  const [ttl, setTtl] = useState(60);
  const [anonymous, setAnonymous] = useState(false);
  const [revealMode, setRevealMode] = useState<"timer" | "clicks">("timer");
  const [revealTimer, setRevealTimer] = useState(30);
  const [maxClicks, setMaxClicks] = useState(3);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(initialCoords ?? null);
  const [locating, setLocating] = useState(!initialCoords);
  const [geocodedAddress, setGeocodedAddress] = useState("");
  const [locationName, setLocationName] = useState("");
  const [cityName, setCityName] = useState("");
  const [countryName, setCountryName] = useState("");
  const [locationResults, setLocationResults] = useState<GeocodeResult[]>([]);
  const [searchingLocations, setSearchingLocations] = useState(false);
  const [locationFocused, setLocationFocused] = useState(false);

  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialCoords) {
      reverseGeocode(initialCoords.lat, initialCoords.lng).then((g) => {
        if (!g) return;
        setGeocodedAddress(g.locationName);
        setCityName(g.cityName ?? "");
        setCountryName(g.countryName ?? "");
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
          setGeocodedAddress(g.locationName);
          setCityName(g.cityName ?? "");
          setCountryName(g.countryName ?? "");
        }).catch(() => {});
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [initialCoords]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const q = locationName.trim();
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
  }, [locationName]);

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

  function selectLocation(r: GeocodeResult) {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setCoords({ lat, lng });
      setGeocodedAddress(r.display_name);
      setLocationName(r.display_name);
      setCityName(cityFromResult(r));
      setCountryName(countryFromResult(r));
    }
    setLocationResults([]);
    setLocationFocused(false);
  }

  function resolvedLocationName() {
    return locationName.trim() || geocodedAddress.trim() || undefined;
  }

  function formatApiError(data: { error?: string; issues?: Array<{ path?: (string | number)[]; message?: string }> } | null) {
    if (!data) return "Couldn't post your story. Please try again.";
    const first = data.issues?.[0];
    if (first) {
      const field = first.path?.join(".") ?? "field";
      return `${data.error ?? "validation_error"}: ${field} — ${first.message ?? "invalid"}`;
    }
    return data.error ?? "Couldn't post your story. Please try again.";
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

      const { encryptMapMessage } = await import("../lib/crypto");
      const encrypted = await encryptMapMessage(message.trim());

      const payload: Record<string, unknown> = {
        ...encrypted,
        lat: coords.lat,
        lng: coords.lng,
        emoji,
        ttlMinutes: ttl,
        revealMode,
      };
      if (!anonymous) payload.handle = handle;
      const loc = resolvedLocationName();
      if (loc) payload.locationName = loc;
      if (cityName) payload.cityName = cityName;
      if (countryName) payload.countryName = countryName;
      if (mediaPath) payload.mediaPath = mediaPath;
      if (mediaType) payload.mediaType = mediaType;
      if (revealMode === "timer") payload.revealTimerSeconds = revealTimer;
      if (revealMode === "clicks") payload.maxClicks = maxClicks;

      const res = await fetch(`${getApiBase()}/v1/secrets/map`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onPosted?.();
        onClose();
      } else {
        const data = await res.json().catch(() => null);
        setError(formatApiError(data));
        setStep("compose");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setStep("compose");
    } finally {
      setPosting(false);
    }
  }

  if (showCamera) {
    return <FullScreenCamera onCapture={(f) => { setShowCamera(false); setFileAndPreview(f); }} onClose={() => setShowCamera(false)} />;
  }

  return (
    <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-surface-raised rounded-t-3xl sm:rounded-3xl border border-border max-h-[92vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 border-b border-border/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold">{step === "compose" ? "Add story" : "Preview"}</h3>
            <button onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text text-xl leading-none px-1">×</button>
          </div>
          <div className="flex items-center gap-2 justify-center">
            {(["compose", "preview"] as Step[]).map((s) => (
              <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${s === step ? "w-8 bg-accent" : "w-3 bg-border"}`} />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === "compose" && (
            <div className="flex flex-col gap-4">
              <div className="relative">
                <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-2">
                  Location
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none">📍</span>
                  <input
                    type="text"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    onFocus={() => setLocationFocused(true)}
                    onBlur={() => setTimeout(() => setLocationFocused(false), 200)}
                    placeholder={
                      locating
                        ? "Finding your location…"
                        : geocodedAddress || (coords ? "Name this place" : "Search or name a place")
                    }
                    disabled={locating}
                    className="w-full rounded-xl bg-surface border border-border pl-9 pr-9 py-2.5 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
                  />
                  {searchingLocations && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
                  )}
                </div>
                {!coords && !locating && (
                  <p className="text-xs text-amber-400 mt-1.5">Pick a spot on the map or search an address.</p>
                )}
                {locationResults.length > 0 && locationFocused && (
                  <div className="absolute left-0 right-0 mt-1 z-10 rounded-xl border border-border bg-surface-raised shadow-lg max-h-48 overflow-y-auto">
                    {locationResults.map((r, idx) => (
                      <button key={`${r.lat}-${r.lon}-${idx}`} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selectLocation(r)} className="w-full text-left px-3 py-2.5 text-xs hover:bg-accent/10 border-b border-border/30 last:border-b-0">
                        {r.display_name}
                      </button>
                    ))}
                  </div>
                )}
                {!searchingLocations && locationFocused && locationName.trim().length >= 3 && locationResults.length === 0 && (
                  <p className="text-xs text-text-muted mt-1.5 px-1">No places found — try a different search or name this spot yourself.</p>
                )}
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="What's your story?"
                className="w-full rounded-xl bg-surface border border-border px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
              />

              <div className="flex items-center gap-1.5 flex-wrap">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => setEmoji(e)} className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${emoji === e ? "bg-accent/20 ring-2 ring-accent" : "hover:bg-surface border border-border"}`}>{e}</button>
                ))}
              </div>

              <div className="flex gap-2">
                <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFileAndPreview(f); }} />
                <button type="button" onClick={() => fileRef.current?.click()} className="text-xs rounded-full border border-border px-3 py-1.5 text-text-muted hover:border-accent/50">Add photo/video</button>
                <button type="button" onClick={() => setShowCamera(true)} className="text-xs rounded-full border border-border px-3 py-1.5 text-text-muted hover:border-accent/50">Camera</button>
              </div>

              {preview && file && (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  {file.type.startsWith("image/") ? <img src={preview} alt="" className="w-full max-h-40 object-cover" /> : <video src={preview} className="w-full max-h-40 object-cover" controls />}
                  <button onClick={clearFile} className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full">×</button>
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-2">Story expires in</label>
                <div className="grid grid-cols-4 gap-2">
                  {TTL_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => setTtl(opt.value)} className={`rounded-xl px-2 py-2 text-xs border ${ttl === opt.value ? "bg-accent/15 border-accent text-accent" : "bg-surface border-border text-text-muted"}`}>{opt.label}</button>
                  ))}
                </div>
              </div>

              <button type="button" onClick={() => setAnonymous((a) => !a)} className="w-full flex items-center justify-between rounded-xl bg-surface border border-border px-3 py-2.5 text-left">
                <span className="text-xs">{anonymous ? "Posting anonymously" : `Posting as @${handle}`}</span>
                <span className={`w-10 h-6 rounded-full ${anonymous ? "bg-accent" : "bg-border"} relative`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${anonymous ? "left-4" : "left-0.5"}`} />
                </span>
              </button>

              <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="text-xs text-text-muted hover:text-accent text-left">
                {showAdvanced ? "Hide advanced" : "Advanced reveal settings"}
              </button>

              {showAdvanced && (
                <div className="space-y-2 rounded-xl border border-border p-3">
                  <div className="flex rounded-xl border border-border overflow-hidden">
                    <button type="button" onClick={() => setRevealMode("timer")} className={`flex-1 text-xs py-2 ${revealMode === "timer" ? "bg-accent text-black" : "text-text-muted"}`}>Timer</button>
                    <button type="button" onClick={() => setRevealMode("clicks")} className={`flex-1 text-xs py-2 ${revealMode === "clicks" ? "bg-accent text-black" : "text-text-muted"}`}>Clicks</button>
                  </div>
                  {revealMode === "timer" ? (
                    <select value={revealTimer} onChange={(e) => setRevealTimer(Number(e.target.value))} className="w-full text-xs bg-surface border border-border rounded-lg px-2 py-1.5">
                      <option value={15}>15 seconds</option>
                      <option value={30}>30 seconds</option>
                      <option value={60}>1 minute</option>
                    </select>
                  ) : (
                    <select value={maxClicks} onChange={(e) => setMaxClicks(Number(e.target.value))} className="w-full text-xs bg-surface border border-border rounded-lg px-2 py-1.5">
                      <option value={1}>1 reveal</option>
                      <option value={3}>3 reveals</option>
                      <option value={5}>5 reveals</option>
                    </select>
                  )}
                </div>
              )}

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button onClick={() => setStep("preview")} disabled={!message.trim() || !coords} className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50">
                Preview →
              </button>
            </div>
          )}

          {step === "preview" && (
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-border bg-surface p-4">
                {preview && file && (
                  <div className="rounded-xl overflow-hidden mb-3">
                    {file.type.startsWith("image/") ? <img src={preview} alt="" className="w-full max-h-40 object-cover" /> : <video src={preview} className="w-full max-h-40 object-cover" controls />}
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{emoji}</span>
                  <div>
                    <p className="text-sm whitespace-pre-wrap">{message}</p>
                    <p className="text-xs text-text-muted mt-2">
                      {anonymous ? "Anonymous" : `@${handle}`} · {TTL_OPTIONS.find((o) => o.value === ttl)?.label}
                      {resolvedLocationName() ? ` · ${resolvedLocationName()}` : ""}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep("compose")} className="flex-1 rounded-full border border-border py-2.5 text-sm text-text-muted">← Edit</button>
                <button onClick={post} disabled={posting} className="flex-1 rounded-full bg-accent py-2.5 text-sm font-bold text-black disabled:opacity-50">
                  {posting ? "Sharing…" : "Share story"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
