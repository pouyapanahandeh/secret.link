import { useCallback, useEffect, useRef, useState } from "react";
import { getApiBase } from "../lib/api.client";
import { markStoryViewed } from "../lib/story-views";
import type { MapSecret } from "../lib/map-types";

interface StoryViewerProps {
  handle: string;
  avatarUrl?: string | null;
  onClose: () => void;
  /** Called when a story becomes visible (so its ring can be dimmed). */
  onViewed?: (storyId: string) => void;
}

const STORY_DURATION_MS = 6000;
const HOLD_MS = 200;

/**
 * Full-screen, Instagram-style viewer for a user's active map "stories".
 * Auto-advances through each story with a progress bar; tap left/right to go
 * back/forward, press-and-hold anywhere to pause. Media is shown behind a
 * skeleton and the progress timer only starts once it has loaded.
 */
export function StoryViewer({ handle, avatarUrl, onClose, onViewed }: StoryViewerProps) {
  const cleanHandle = handle.replace(/^@/, "");
  const [stories, setStories] = useState<MapSecret[] | null>(null);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const holdTimerRef = useRef<number | null>(null);
  const holdingRef = useRef(false);

  // Load this user's active stories.
  useEffect(() => {
    let cancelled = false;
    fetch(`${getApiBase()}/v1/secrets/map/by-handle/${encodeURIComponent(cleanHandle)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MapSecret[]) => {
        if (!cancelled) setStories(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setStories([]);
      });
    return () => {
      cancelled = true;
    };
  }, [cleanHandle]);

  const advance = useCallback(() => {
    setIndex((i) => {
      const total = stories?.length ?? 0;
      if (i + 1 >= total) {
        onClose();
        return i;
      }
      return i + 1;
    });
    setProgress(0);
    elapsedRef.current = 0;
  }, [stories, onClose]);

  // Current story + whether its media has loaded (gates the progress timer so
  // the countdown only starts once the image/video is actually on screen).
  const current = stories?.[index] ?? null;
  const curMediaPath = current ? (current.mediaPath ?? null) : null;
  const curMediaType = current ? (current.mediaType ?? "") : "";
  const curHasMedia = !!curMediaPath && (curMediaType.startsWith("image/") || curMediaType.startsWith("video/"));
  const mediaReady = !curHasMedia || mediaLoaded;

  // Drive the progress bar / auto-advance.
  useEffect(() => {
    if (!stories || stories.length === 0) return;
    if (paused || !mediaReady) return;

    startRef.current = performance.now() - elapsedRef.current;

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      elapsedRef.current = elapsed;
      const pct = Math.min(elapsed / STORY_DURATION_MS, 1);
      setProgress(pct);
      if (pct >= 1) {
        advance();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [stories, index, paused, mediaReady, advance]);

  // Reset the media-loaded flag whenever the visible story changes.
  useEffect(() => {
    setMediaLoaded(false);
  }, [index]);

  // Mark the visible story as viewed (dims its ring) + notify the parent.
  useEffect(() => {
    if (!stories || stories.length === 0) return;
    const s = stories[index];
    if (s?.id) {
      markStoryViewed(s.id);
      onViewed?.(s.id);
    }
  }, [stories, index, onViewed]);

  // Preload the next story's image for a smoother transition.
  useEffect(() => {
    if (!stories) return;
    const next = stories[index + 1];
    if (!next) return;
    const np = next.mediaPath ?? null;
    const nt = next.mediaType ?? "";
    if (np && nt.startsWith("image/")) {
      const img = new Image();
      img.src = `${getApiBase()}/v1/secrets/blob/${np}`;
    }
  }, [stories, index]);

  // Keyboard navigation.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") advance();
      else if (e.key === "ArrowLeft") {
        setIndex((i) => Math.max(0, i - 1));
        setProgress(0);
        elapsedRef.current = 0;
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [advance, onClose]);

  const goPrev = () => {
    setIndex((i) => Math.max(0, i - 1));
    setProgress(0);
    elapsedRef.current = 0;
  };

  function clearHold() {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }

  // Press-and-hold anywhere pauses; a quick tap navigates by horizontal position.
  function handlePointerDown() {
    holdingRef.current = false;
    holdTimerRef.current = window.setTimeout(() => {
      holdingRef.current = true;
      setPaused(true);
    }, HOLD_MS);
  }

  function handlePointerUp(e: React.PointerEvent) {
    clearHold();
    if (holdingRef.current) {
      holdingRef.current = false;
      setPaused(false);
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    const x = e.clientX - (rect?.left ?? 0);
    const w = rect?.width ?? window.innerWidth;
    if (x < w * 0.33) goPrev();
    else advance();
  }

  function handlePointerLeave() {
    clearHold();
    if (holdingRef.current) {
      holdingRef.current = false;
      setPaused(false);
    }
  }

  if (stories === null) {
    return (
      <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center">
        <span className="text-white/60 text-sm">Loading…</span>
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center gap-4">
        <p className="text-white/70 text-sm">@{cleanHandle} has no active stories.</p>
        <button onClick={onClose} className="text-white text-sm underline">
          Close
        </button>
      </div>
    );
  }

  const story = stories[index]!;
  const mediaPath = story.mediaPath ?? null;
  const mediaType = story.mediaType ?? "";

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col select-none">
      {/* Progress bars */}
      <div className="flex gap-1 px-3 pt-3">
        {stories.map((s, i) => (
          <div key={s.id} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full"
              style={{ width: `${i < index ? 100 : i === index ? progress * 100 : 0}%` }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent/20 border border-white/40 flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-white">{cleanHandle[0]?.toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0">
            <span className="text-white text-sm font-semibold">@{cleanHandle}</span>
            {(story.locationName || story.cityName) && (
              <p className="text-white/70 text-[11px] truncate max-w-[65vw]">📍 {story.locationName || story.cityName}</p>
            )}
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" className="text-white/80 hover:text-white text-2xl leading-none px-2">
          ×
        </button>
      </div>

      {/* Content — press-and-hold to pause, tap left/right to navigate */}
      <div
        ref={containerRef}
        className="relative flex-1 flex items-center justify-center px-6 touch-none"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerLeave}
      >
        <div className="max-w-md w-full text-center">
          {curHasMedia && !mediaReady && (
            <div className="w-full h-[50vh] rounded-xl bg-white/10 animate-pulse mb-4" />
          )}
          {mediaPath && mediaType.startsWith("image/") && (
            <img
              src={`${getApiBase()}/v1/secrets/blob/${mediaPath}`}
              alt=""
              onLoad={() => setMediaLoaded(true)}
              onError={() => setMediaLoaded(true)}
              className={`max-h-[60vh] w-auto mx-auto rounded-xl mb-4 object-contain ${mediaReady ? "" : "hidden"}`}
            />
          )}
          {mediaPath && mediaType.startsWith("video/") && (
            <video
              src={`${getApiBase()}/v1/secrets/blob/${mediaPath}`}
              autoPlay
              muted
              playsInline
              onLoadedData={() => setMediaLoaded(true)}
              onError={() => setMediaLoaded(true)}
              className={`max-h-[60vh] w-auto mx-auto rounded-xl mb-4 ${mediaReady ? "" : "hidden"}`}
            />
          )}
          {story.emoji && <div className="text-4xl mb-3">{story.emoji}</div>}
          <p className="text-white text-lg leading-relaxed whitespace-pre-wrap break-words">{story.message}</p>
        </div>
      </div>
    </div>
  );
}
