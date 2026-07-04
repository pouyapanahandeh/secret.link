import { useState, useRef, useEffect, useCallback } from "react";
import { getApiBase } from "../lib/api.client";

const IVS_PLAYER_URL = "https://player.live-video.net/1.30.0/amazon-ivs-player.min.js";

/** Load IVS player SDK via script tag (avoids Vite WASM worker bundling issues) */
function loadIvsPlayerScript(): Promise<any> {
  if ((window as any).IVSPlayer) return Promise.resolve((window as any).IVSPlayer);

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = IVS_PLAYER_URL;
    script.async = true;
    script.onload = () => {
      if ((window as any).IVSPlayer) resolve((window as any).IVSPlayer);
      else reject(new Error("IVSPlayer not found after script load"));
    };
    script.onerror = () => reject(new Error("Failed to load IVS player script"));
    document.head.appendChild(script);
  });
}

interface StreamPlayerProps {
  playbackUrl: string;
  title?: string;
  handle?: string | null;
  viewerCount?: number;
  streamId?: string;
  onClose?: () => void;
  /** Inline mode (no overlay) */
  inline?: boolean;
}

export function StreamPlayer({
  playbackUrl,
  title,
  handle,
  viewerCount: initialViewerCount = 0,
  streamId,
  onClose,
  inline,
}: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "playing" | "ended" | "error">("loading");
  const [viewerCount, setViewerCount] = useState(initialViewerCount);
  const [muted, setMuted] = useState(true); // autoplay requires muted
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load player and start playback
  useEffect(() => {
    let disposed = false;

    async function init() {
      try {
        // Load IVS player from CDN (avoids Vite bundling issues with WASM workers)
        const IVSPlayer: any = await loadIvsPlayerScript();
        if (disposed) return;

        if (!IVSPlayer.isPlayerSupported) {
          setStatus("error");
          return;
        }

        const player = IVSPlayer.create();
        playerRef.current = player;

        player.attachHTMLVideoElement(videoRef.current!);

        player.addEventListener(IVSPlayer.PlayerState.PLAYING, () => {
          if (!disposed) setStatus("playing");
        });

        player.addEventListener(IVSPlayer.PlayerState.ENDED, () => {
          if (!disposed) setStatus("ended");
        });

        player.addEventListener(IVSPlayer.PlayerEventType.ERROR, () => {
          if (!disposed) setStatus("error");
        });

        player.setAutoplay(true);
        player.setMuted(true);
        player.load(playbackUrl);
      } catch {
        if (!disposed) setStatus("error");
      }
    }

    init();

    return () => {
      disposed = true;
      if (playerRef.current) {
        try { playerRef.current.pause(); } catch {}
        try { playerRef.current.delete(); } catch {}
        playerRef.current = null;
      }
    };
  }, [playbackUrl]);

  // Poll viewer count
  useEffect(() => {
    if (!streamId) return;

    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${getApiBase()}/v1/streams/${streamId}`);
        if (r.ok) {
          const d = await r.json();
          setViewerCount(d.viewerCount ?? 0);
          if (d.status === "ended") setStatus("ended");
        }
      } catch {}
    }, 10000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [streamId]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (playerRef.current) {
      const next = !muted;
      playerRef.current.setMuted(next);
      setMuted(next);
    }
  }, [muted]);

  const content = (
    <div className={`relative bg-black ${inline ? "rounded-xl overflow-hidden" : "w-full h-full"}`}>
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        muted
      />

      {/* Loading overlay */}
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
        </div>
      )}

      {/* Ended overlay */}
      {status === "ended" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <p className="text-white text-lg font-medium mb-2">Stream ended</p>
            {onClose && (
              <button
                onClick={onClose}
                className="text-accent text-sm hover:underline"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error overlay */}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <p className="text-white text-lg font-medium mb-2">Unable to load stream</p>
            {onClose && (
              <button
                onClick={onClose}
                className="text-accent text-sm hover:underline"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top bar: LIVE badge, title, close */}
      {status === "playing" && (
        <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/60 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
              </span>
              LIVE
            </span>
            {handle && (
              <span className="text-white text-sm font-medium">@{handle}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/80 text-xs">👁 {viewerCount}</span>
            {onClose && (
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white text-lg leading-none"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bottom bar: title + mute toggle */}
      {status === "playing" && (
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent flex items-center justify-between">
          {title && (
            <p className="text-white text-sm truncate mr-3">{title}</p>
          )}
          <button
            onClick={toggleMute}
            className="text-white/80 hover:text-white text-sm shrink-0"
          >
            {muted ? "🔇 Unmute" : "🔊 Muted"}
          </button>
        </div>
      )}
    </div>
  );

  // Fullscreen overlay mode
  if (!inline) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
}
