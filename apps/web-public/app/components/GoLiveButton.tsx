import { useState, useRef, useCallback, useEffect } from "react";
import { getApiBase } from "../lib/api.client";

type BroadcastState = "idle" | "requesting" | "previewing" | "connecting" | "live" | "error";

interface GoLiveButtonProps {
  token: string;
  onStreamStarted?: (streamId: string) => void;
  onStreamEnded?: () => void;
}

export function GoLiveButton({ token, onStreamStarted, onStreamEnded }: GoLiveButtonProps) {
  const [state, setState] = useState<BroadcastState>("idle");
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [viewerCount, setViewerCount] = useState(0);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Stream settings
  const [maxViewers, setMaxViewers] = useState(0); // 0 = unlimited
  const [nsfw, setNsfw] = useState(false);

  // Media controls
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  const clientRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const viewerPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { cleanupBroadcast(); };
  }, []);

  useEffect(() => {
    if ((state === "previewing" || state === "live") && previewRef.current && clientRef.current) {
      try { clientRef.current.attachPreview(previewRef.current); } catch {}
    }
  }, [state]);

  function cleanupBroadcast() {
    if (clientRef.current) {
      try { clientRef.current.stopBroadcast(); } catch {}
      try { clientRef.current.delete(); } catch {}
      clientRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (viewerPollRef.current) clearInterval(viewerPollRef.current);
  }

  // Toggle microphone
  const toggleMic = useCallback(() => {
    if (!mediaStreamRef.current) return;
    const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicMuted(!audioTrack.enabled);
    }
  }, []);

  // Toggle camera
  const toggleCam = useCallback(() => {
    if (!mediaStreamRef.current) return;
    const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCamOff(!videoTrack.enabled);
    }
  }, []);

  const startPreview = useCallback(async () => {
    setState("requesting");
    setError("");
    try {
      const IVSModule = await import("amazon-ivs-web-broadcast");
      const IVSBroadcast = IVSModule.default || IVSModule;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: "user" },
          audio: true,
        });
      } catch (mediaErr: any) {
        throw new Error(`Camera/mic blocked: ${mediaErr.name}`);
      }
      mediaStreamRef.current = stream;

      const createFn = (IVSBroadcast as any).create || IVSBroadcast;
      const streamConfig = (IVSBroadcast as any).BASIC_LANDSCAPE;
      const client = typeof createFn === "function"
        ? createFn({ streamConfig })
        : (IVSBroadcast as any).create({ streamConfig });
      clientRef.current = client;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        await client.addVideoInputDevice(new MediaStream([videoTrack]), "camera", { index: 0 });
      }
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        await client.addAudioInputDevice(new MediaStream([audioTrack]), "mic");
      }
      setState("previewing");
    } catch (err: any) {
      console.error("[GoLive]", err);
      setError(err.message || "Failed to start preview");
      setState("error");
    }
  }, []);

  const goLive = useCallback(async () => {
    if (!clientRef.current) return;
    setState("connecting");
    setError("");
    try {
      const res = await fetch(`${getApiBase()}/v1/streams/go-live`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: title.trim() || "Live",
          maxViewers,
          nsfw,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start stream");
      }
      const { streamId: sid, ingestEndpoint, streamKey, shareLink: link } = await res.json();

      await clientRef.current.startBroadcast(streamKey, ingestEndpoint);

      setShareLink(`${window.location.origin}${link}`);
      setState("live");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
      viewerPollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`${getApiBase()}/v1/streams/${sid}`);
          if (r.ok) { const d = await r.json(); setViewerCount(d.viewerCount ?? 0); }
        } catch {}
      }, 10000);
      onStreamStarted?.(sid);
    } catch (err: any) {
      console.error("[GoLive] Broadcast error:", err);
      setError(err.message || "Failed to go live");
      setState("error");
    }
  }, [title, token, maxViewers, nsfw, onStreamStarted]);

  const endStream = useCallback(async () => {
    try {
      await fetch(`${getApiBase()}/v1/streams/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
    } catch {}
    cleanupBroadcast();
    setState("idle");
    setShareLink(null);
    setElapsed(0);
    setViewerCount(0);
    setCopied(false);
    onStreamEnded?.();
  }, [token, onStreamEnded]);

  const cancelPreview = useCallback(() => {
    cleanupBroadcast();
    setState("idle");
    setError("");
  }, []);

  const copyLink = useCallback(() => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareLink]);

  function formatTime(s: number) {
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  }

  /* ─── UI States ──────────────────────────────────────────────────────── */

  if (state === "idle") {
    return (
      <button
        onClick={startPreview}
        className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-accent/10 border border-accent/30 px-5 py-3 text-sm font-bold text-accent hover:bg-accent/20 transition-all"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" />
        </span>
        Start Camera
      </button>
    );
  }

  if (state === "error") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setState("idle")} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm text-text-muted hover:text-text transition-colors">
            Cancel
          </button>
          <button onClick={startPreview} className="flex-1 rounded-xl bg-accent/10 border border-accent/30 px-4 py-2.5 text-sm font-semibold text-accent hover:bg-accent/20 transition-colors">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (state === "requesting") {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent/30 border-t-accent" />
        <p className="text-sm text-text-muted">Requesting camera access…</p>
      </div>
    );
  }

  if (state === "previewing") {
    return (
      <div className="space-y-3">
        {/* Preview */}
        <div className="relative rounded-xl overflow-hidden bg-black">
          <canvas ref={previewRef} className="w-full aspect-video" />
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-xs text-text-muted px-2.5 py-1 rounded-full">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Preview
          </div>
          {/* Mic/Cam toggles on preview */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
            <button onClick={toggleMic} className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${micMuted ? "bg-red-500/80" : "bg-black/60 backdrop-blur-sm"}`}>
              {micMuted ? (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M19 19L5 5m7 14a7 7 0 01-7-7V8m14 4a7 7 0 01-.65 2.96M12 19v3m-4-3h8" /></svg>
              ) : (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>
              )}
            </button>
            <button onClick={toggleCam} className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${camOff ? "bg-red-500/80" : "bg-black/60 backdrop-blur-sm"}`}>
              {camOff ? (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 01-2.25-2.25V7.5A2.25 2.25 0 014.5 5.25h7.5M3 3l18 18" /></svg>
              ) : (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" /></svg>
              )}
            </button>
          </div>
        </div>

        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a title…"
          maxLength={200}
          className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors"
        />

        {/* Max viewers */}
        <div>
          <label className="text-[10px] text-text-muted uppercase tracking-wide block mb-1">Max viewers (0 = unlimited)</label>
          <select value={maxViewers} onChange={(e) => setMaxViewers(Number(e.target.value))} className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm text-text">
            <option value={0}>Unlimited</option>
            <option value={1}>1 viewer</option>
            <option value={3}>3 viewers</option>
            <option value={5}>5 viewers</option>
            <option value={10}>10 viewers</option>
            <option value={25}>25 viewers</option>
            <option value={50}>50 viewers</option>
          </select>
        </div>

        {/* 18+ toggle */}
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={nsfw}
            onChange={(e) => setNsfw(e.target.checked)}
            className="w-4 h-4 rounded border-border bg-surface accent-accent"
          />
          <span className="text-sm text-text-muted">18+ content</span>
        </label>

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={cancelPreview} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm text-text-muted hover:text-text transition-colors">
            Cancel
          </button>
          <button onClick={goLive} className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-black hover:bg-accent/90 transition-all">
            Go Live
          </button>
        </div>
      </div>
    );
  }

  if (state === "connecting") {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent/30 border-t-accent" />
        <p className="text-sm text-text-muted">Connecting…</p>
      </div>
    );
  }

  // ─── LIVE STATE ────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Video */}
      <div className="relative rounded-xl overflow-hidden bg-black">
        <canvas ref={previewRef} className="w-full aspect-video" />
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            LIVE
          </span>
          <div className="flex items-center gap-2">
            <span className="bg-black/60 backdrop-blur-sm text-xs text-white px-2.5 py-1 rounded-full font-mono">
              {formatTime(elapsed)}
            </span>
            <span className="bg-black/60 backdrop-blur-sm text-xs text-white px-2.5 py-1 rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              {viewerCount}
            </span>
          </div>
        </div>
        {/* Mic/Cam controls */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          <button onClick={toggleMic} className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${micMuted ? "bg-red-500/80" : "bg-black/60 backdrop-blur-sm"}`}>
            {micMuted ? (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M19 19L5 5m7 14a7 7 0 01-7-7V8m14 4a7 7 0 01-.65 2.96M12 19v3m-4-3h8" /></svg>
            ) : (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>
            )}
          </button>
          <button onClick={toggleCam} className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${camOff ? "bg-red-500/80" : "bg-black/60 backdrop-blur-sm"}`}>
            {camOff ? (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 01-2.25-2.25V7.5A2.25 2.25 0 014.5 5.25h7.5M3 3l18 18" /></svg>
            ) : (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" /></svg>
            )}
          </button>
        </div>
      </div>

      {/* Share link */}
      {shareLink && (
        <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-2">
          <input
            type="text"
            readOnly
            value={shareLink}
            className="flex-1 text-xs text-text-muted bg-transparent truncate focus:outline-none"
          />
          <button onClick={copyLink} className="text-xs font-semibold text-accent shrink-0">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}

      {/* End button */}
      <button
        onClick={endStream}
        className="w-full rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
      >
        End Stream
      </button>
    </div>
  );
}
