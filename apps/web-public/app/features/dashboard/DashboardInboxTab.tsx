import { Link, useFetcher } from "@remix-run/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getProfileUrl } from "@secretlink/core/profile-url";
import { Avatar } from "../../components/Avatar";
import { NotificationPrompt } from "../../components/NotificationPrompt";
import { StoriesRow } from "../../components/StoriesRow";
import { LiveStreams } from "../../components/LiveStreams";
import { UI_FEATURES } from "../../lib/feature-flags";
import { getApiBase } from "../../lib/api.client";
import type { DashboardInboxTabProps, SentSecret } from "./types";

const SENT_PAGE_SIZE = 10;

export function DashboardInboxTab({
  user,
  inbox,
  sent: initialSent,
  sentHasMore: initialHasMore,
  sentNextOffset: initialNextOffset,
  token,
  following,
  storyHandleSet,
  viewedHandles,
  onSelectStoryUser,
  passkey,
}: DashboardInboxTabProps) {
  const searchFetcher = useFetcher<unknown[]>();
  const followFetcher = useFetcher<{ following: boolean; followersCount: number }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const lastFollowRef = useRef<string | null>(null);

  const [sent, setSent] = useState<SentSecret[]>(initialSent);
  const [sentHasMore, setSentHasMore] = useState(initialHasMore);
  const [sentNextOffset, setSentNextOffset] = useState(initialNextOffset);
  const [sentLoading, setSentLoading] = useState(false);
  const sentSentinelRef = useRef<HTMLDivElement | null>(null);
  const sentLoadingRef = useRef(false);

  useEffect(() => {
    setSent(initialSent);
    setSentHasMore(initialHasMore);
    setSentNextOffset(initialNextOffset);
  }, [initialSent, initialHasMore, initialNextOffset]);

  const loadMoreSent = useCallback(async () => {
    if (sentLoadingRef.current || !sentHasMore) return;
    sentLoadingRef.current = true;
    setSentLoading(true);
    try {
      const res = await fetch(
        `${getApiBase()}/v1/secrets/sent/${user.id}?limit=${SENT_PAGE_SIZE}&offset=${sentNextOffset}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return;
      const body = await res.json();
      const items = (Array.isArray(body.items) ? body.items : []) as SentSecret[];
      setSent((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        return [...prev, ...items.filter((s) => !seen.has(s.id))];
      });
      setSentHasMore(!!body.hasMore);
      setSentNextOffset(Number(body.nextOffset ?? sentNextOffset + items.length));
    } finally {
      sentLoadingRef.current = false;
      setSentLoading(false);
    }
  }, [sentHasMore, sentNextOffset, token, user.id]);

  useEffect(() => {
    const node = sentSentinelRef.current;
    if (!node || !sentHasMore) return;
    const root = node.closest(".overflow-y-auto");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadMoreSent();
        }
      },
      { root: root instanceof Element ? root : null, rootMargin: "160px", threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMoreSent, sentHasMore, sent.length]);

  const searchResults = (Array.isArray(searchFetcher.data) ? searchFetcher.data : []) as Array<{
    id: string;
    handle: string;
    bio?: string;
    avatarUrl?: string | null;
    isPro?: boolean;
    isFollowing?: boolean;
  }>;
  const searching = searchFetcher.state !== "idle";

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    const timer = setTimeout(() => {
      searchFetcher.submit({ intent: "search", q }, { method: "post" });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!Array.isArray(searchFetcher.data)) return;
    setFollowingMap((prev) => {
      const next = { ...prev };
      for (const u of searchFetcher.data as Array<{ id: string; isFollowing?: boolean }>) {
        if (!(u.id in next)) next[u.id] = !!u.isFollowing;
      }
      return next;
    });
  }, [searchFetcher.data]);

  useEffect(() => {
    if (followFetcher.state === "idle" && followFetcher.data && lastFollowRef.current) {
      const id = lastFollowRef.current;
      setFollowingMap((prev) => ({ ...prev, [id]: !!followFetcher.data!.following }));
      lastFollowRef.current = null;
    }
  }, [followFetcher.state, followFetcher.data]);

  function toggleFollow(targetId: string) {
    const next = !followingMap[targetId];
    lastFollowRef.current = targetId;
    setFollowingMap((prev) => ({ ...prev, [targetId]: next }));
    followFetcher.submit(
      { intent: next ? "follow" : "unfollow", targetId },
      { method: "post" },
    );
  }

  return (
    <section>
      <NotificationPrompt token={token} />

      <div className="flex items-center gap-3 mb-6">
        <Avatar
          handle={user.handle}
          avatarUrl={user.avatarUrl}
          sizeClass="w-12 h-12"
          textClass="text-lg"
          className="border-2 border-accent"
        />
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-accent mb-0.5">Home</p>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate">@{user.handle}</h1>
          <p className="font-mono text-[10px] tracking-wide uppercase text-text-muted truncate">
            {user.email ?? "No email"} · {user.isPro ? "Pro" : "Free"}
          </p>
        </div>
        <Link to={`/${user.handle}`} className="shrink-0 rounded-full bg-accent px-4 py-2 text-xs font-extrabold text-black">
          View
        </Link>
      </div>

      {UI_FEATURES.live && <LiveStreams compact />}

      <div className="flex items-center gap-2 mb-6 bg-surface-raised border border-border px-3 py-2.5">
        <span className="font-mono text-[10px] text-text-muted shrink-0">URL</span>
        <code className="font-mono text-xs sm:text-sm text-text truncate flex-1">secretlink.life/@{user.handle}</code>
        <button
          onClick={() => navigator.clipboard?.writeText(getProfileUrl(user.handle))}
          className="font-mono text-[10px] tracking-[0.14em] uppercase text-accent shrink-0 font-semibold"
        >
          Copy
        </button>
      </div>

      <StoriesRow
        users={following}
        storyHandles={storyHandleSet}
        viewedHandles={viewedHandles}
        onSelect={onSelectStoryUser}
      />

      <div className="mb-6">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search @username..."
            className="w-full pl-10 pr-4 py-2.5 min-h-11 bg-surface-raised border border-border text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-accent"
          />
        </div>
        {searching && <p className="text-xs text-text-muted text-center mt-2">Searching...</p>}
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {searchResults.map((u) => (
              <div key={u.id} className="flex items-center gap-3 bg-surface-raised border border-border p-3">
                <Link to={`/${u.handle}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar handle={u.handle} avatarUrl={u.avatarUrl} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">@{u.handle} {u.isPro && "⭐"}</p>
                    {u.bio && <p className="text-xs text-text-muted truncate">{u.bio}</p>}
                  </div>
                </Link>
                {u.id !== user.id && (
                  <button
                    onClick={() => toggleFollow(u.id)}
                    className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-extrabold transition-colors ${
                      followingMap[u.id]
                        ? "bg-surface border border-border text-text-muted"
                        : "bg-accent text-black"
                    }`}
                  >
                    {followingMap[u.id] ? "Following" : "Follow"}
                  </button>
                )}
                {u.id !== user.id && (
                  <button
                    onClick={() =>
                      onSelectStoryUser(
                        { id: u.id, handle: u.handle, avatarUrl: u.avatarUrl ?? null, bio: u.bio, isPro: u.isPro },
                        storyHandleSet.has(u.handle.toLowerCase()),
                      )
                    }
                    aria-label={`Actions for @${u.handle}`}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-text-muted hover:bg-surface hover:text-text transition-colors"
                  >
                    ⋯
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
          <p className="text-xs text-text-muted text-center mt-3">No users found</p>
        )}
      </div>

      {!passkey.hasPasskey && (
        <button
          onClick={passkey.onAddPasskey}
          disabled={passkey.status === "loading"}
          className="w-full mb-4 text-sm bg-surface-raised border border-border text-text px-4 py-3 min-h-11 font-semibold hover:border-accent/50 transition-colors disabled:opacity-50"
        >
          {passkey.status === "loading" ? "Setting up..." : "🔑 Add passkey for faster login"}
        </button>
      )}
      {passkey.error && <p className="text-red-400 text-xs mb-4">{passkey.error}</p>}

      <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase text-accent mb-3 flex items-center gap-2">
        Inbox
        {inbox.length > 0 && <span className="font-sans text-[10px] font-extrabold bg-accent text-black px-2 py-0.5 rounded-full">{inbox.length}</span>}
      </h2>

      {inbox.length === 0 ? (
        <div className="bg-surface-raised border border-border p-6 text-center">
          <p className="text-sm font-semibold">No secrets yet</p>
          <p className="text-xs text-text-muted mt-1">
            Share your link on Instagram or TikTok to receive secrets
          </p>
        </div>
      ) : (
        <div className="border border-border divide-y divide-border">
          {inbox.map((secret: any) => (
            <Link
              key={secret.id}
              to={`/s/${secret.id}`}
              className="group flex items-center gap-3 bg-surface p-3 sm:p-4 hover:bg-accent hover:text-black transition-colors"
            >
              <span className="text-xl">
                {secret.contentType === "text" ? "💬" : secret.contentType === "image" ? "🖼️" : "📎"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold truncate">{secret.contentType} secret</p>
                <p className="text-xs text-text-muted group-hover:text-black/70">
                  {secret.burned ? "Burned" : secret.viewCount > 0 ? "Viewed" : "New"}
                </p>
              </div>
              <span className="font-mono text-[10px] text-text-muted shrink-0">
                {new Date(secret.createdAt).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>
      )}

      <h2 className="font-mono text-[11px] tracking-[0.2em] uppercase text-accent mt-8 mb-3">Sent</h2>
      {sent.length === 0 ? (
        <div className="bg-surface-raised border border-border p-6 text-center">
          <p className="text-sm font-semibold">No secrets sent</p>
          <Link to="/send" className="text-xs font-extrabold text-accent mt-2 inline-block">Send one →</Link>
        </div>
      ) : (
        <div className="border border-border divide-y divide-border">
          {sent.map((secret) => (
            <div key={secret.id} className="flex items-center gap-3 bg-surface p-3 sm:p-4">
              <span className="text-xl">
                {secret.contentType === "text" ? "💬" : "📎"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold truncate">
                  → {secret.recipientHandle ? `@${secret.recipientHandle}` : "Link"}
                </p>
                <p className="text-xs text-text-muted">
                  {secret.burned ? "Burned" : (secret.viewCount ?? 0) > 0 ? `${secret.viewCount}/${secret.maxViews}` : "Pending"}
                </p>
              </div>
              <span className="font-mono text-[10px] text-text-muted shrink-0">
                {new Date(secret.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}
          {sentHasMore && (
            <div ref={sentSentinelRef} className="py-4 text-center">
              <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-text-muted">
                {sentLoading ? "Loading…" : "Scroll for older sends"}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
