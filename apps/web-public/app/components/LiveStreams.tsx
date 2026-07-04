import { useState, useEffect, useCallback } from "react";
import { getApiBase } from "../lib/api.client";
import { StreamPlayer } from "./StreamPlayer";

interface LiveStream {
  id: string;
  handle: string | null;
  title: string;
  viewerCount: number;
  startedAt: string;
  lat: number | null;
  lng: number | null;
  playbackUrl?: string;
}

interface LiveStreamsProps {
  /** Compact mode for sidebar/embedded use */
  compact?: boolean;
}

export function LiveStreams({ compact }: LiveStreamsProps) {
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [watching, setWatching] = useState<LiveStream | null>(null);

  const fetchStreams = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/v1/streams/live`);
      if (res.ok) {
        setStreams(await res.json());
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStreams();
    const interval = setInterval(fetchStreams, 30000);
    return () => clearInterval(interval);
  }, [fetchStreams]);

  // Watching a stream in fullscreen
  if (watching) {
    return (
      <StreamPlayer
        playbackUrl={watching.playbackUrl!}
        title={watching.title}
        handle={watching.handle}
        viewerCount={watching.viewerCount}
        streamId={watching.id}
        onClose={() => setWatching(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" />
      </div>
    );
  }

  if (streams.length === 0) {
    return (
      <div className={`text-center ${compact ? "py-4" : "py-12"}`}>
        <p className="text-3xl mb-2">📡</p>
        <p className="text-sm text-text-muted">No one is live right now</p>
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {!compact && (
        <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider">
          🔴 Live Now ({streams.length})
        </h3>
      )}
      {streams.map((s) => (
        <button
          key={s.id}
          onClick={() => setWatching(s)}
          className={`w-full text-left rounded-xl border border-border hover:border-red-500/50 bg-surface-raised transition-all ${
            compact ? "p-2.5" : "p-3"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center text-lg">
                📹
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {s.handle && (
                  <span className="text-sm font-medium text-text">@{s.handle}</span>
                )}
                <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">LIVE</span>
              </div>
              <p className="text-xs text-text-muted truncate">{s.title || "Untitled stream"}</p>
            </div>
            <span className="text-xs text-text-muted shrink-0">
              👁 {s.viewerCount}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

/**
 * Hook to check if a specific user is live.
 * Returns their stream data or null.
 */
export function useLiveStream(handle: string | null) {
  const [stream, setStream] = useState<LiveStream | null>(null);

  useEffect(() => {
    if (!handle) return;

    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(`${getApiBase()}/v1/streams/by-handle/${handle}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setStream(data.live ? data.stream : null);
          }
        }
      } catch {}
    }

    check();
    const interval = setInterval(check, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [handle]);

  return stream;
}
