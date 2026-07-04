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
    if (compact) return null;
    return (
      <div className="text-center py-12">
        <p className="text-3xl mb-2">📡</p>
        <p className="text-sm text-text-muted">No one is live right now</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="mb-5 flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
        {streams.map((s) => (
          <CompactLiveCard key={s.id} stream={s} onWatch={() => setWatching(s)} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider">
        🔴 Live Now ({streams.length})
      </h3>
      {streams.map((s) => (
        <CompactLiveCard key={s.id} stream={s} onWatch={() => setWatching(s)} />
      ))}
    </div>
  );
}

function formatElapsed(startedAt: string): string {
  const diff = Math.max(0, Date.now() - new Date(startedAt).getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

function CompactLiveCard({ stream: s, onWatch }: { stream: LiveStream; onWatch: () => void }) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(s.startedAt));

  useEffect(() => {
    const id = setInterval(() => setElapsed(formatElapsed(s.startedAt)), 30_000);
    return () => clearInterval(id);
  }, [s.startedAt]);

  return (
    <button
      onClick={onWatch}
      className="group shrink-0 w-52 text-left rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-950/40 via-surface-raised to-surface-raised hover:border-red-500/40 hover:shadow-lg hover:shadow-red-500/5 transition-all duration-200"
    >
      {/* Top: avatar + handle + LIVE badge */}
      <div className="flex items-center gap-2.5 px-3.5 pt-3.5 pb-2">
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-full bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center text-sm font-bold text-red-400">
            {s.handle ? s.handle[0]!.toUpperCase() : "?"}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-text truncate">@{s.handle ?? "anon"}</span>
            <span className="text-[10px] bg-red-600 text-white px-1.5 py-px rounded font-bold leading-tight shrink-0">LIVE</span>
          </div>
          <p className="text-xs text-text-muted truncate mt-0.5">{s.title || "Untitled stream"}</p>
        </div>
      </div>

      {/* Bottom: stats row */}
      <div className="flex items-center gap-3 px-3.5 pb-3 pt-1 text-[11px] text-text-muted">
        <span className="flex items-center gap-1 tabular-nums">
          <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          {s.viewerCount}
        </span>
        <span className="flex items-center gap-1 tabular-nums">
          <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
            <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {elapsed}
        </span>
        <span className="ml-auto text-accent opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium">
          Watch →
        </span>
      </div>
    </button>
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
