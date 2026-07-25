import { Link, useFetcher } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { getProfileUrl } from "@secretlink/core/profile-url";
import { Avatar } from "../../components/Avatar";
import { NotificationPrompt } from "../../components/NotificationPrompt";
import { StoriesRow } from "../../components/StoriesRow";
import { LiveStreams } from "../../components/LiveStreams";
import { UI_FEATURES } from "../../lib/feature-flags";
import type { DashboardInboxTabProps } from "./types";

export function DashboardInboxTab({
  user,
  inbox,
  sent,
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
          <h1 className="text-base sm:text-lg font-bold truncate">@{user.handle}</h1>
          <p className="text-xs text-text-muted truncate">
            {user.email ?? "No email"} · {user.isPro ? "Pro ⭐" : "Free"}
          </p>
        </div>
        <Link to={`/${user.handle}`} className="shrink-0 text-xs bg-accent/10 text-accent px-3 py-1.5 rounded-full">
          View
        </Link>
      </div>

      {UI_FEATURES.live && <LiveStreams compact />}

      <div className="flex items-center gap-2 mb-6 bg-surface-raised rounded-xl border border-border px-3 py-2.5">
        <span className="text-xs text-text-muted shrink-0">🔗</span>
        <code className="text-xs sm:text-sm text-text truncate flex-1">secretlink.life/@{user.handle}</code>
        <button
          onClick={() => navigator.clipboard?.writeText(getProfileUrl(user.handle))}
          className="text-xs text-accent shrink-0"
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
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-raised border border-border text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>
        {searching && <p className="text-xs text-text-muted text-center mt-2">Searching...</p>}
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {searchResults.map((u) => (
              <div key={u.id} className="flex items-center gap-3 bg-surface-raised rounded-xl border border-border p-3">
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
                    className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
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
          className="w-full mb-4 text-sm bg-surface-raised border border-border text-text px-4 py-3 rounded-xl hover:border-accent/50 transition-colors disabled:opacity-50"
        >
          {passkey.status === "loading" ? "Setting up..." : "🔑 Add passkey for faster login"}
        </button>
      )}
      {passkey.error && <p className="text-red-400 text-xs mb-4">{passkey.error}</p>}

      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
        📥 Inbox
        {inbox.length > 0 && <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">{inbox.length}</span>}
      </h2>

      {inbox.length === 0 ? (
        <div className="bg-surface-raised rounded-xl border border-border p-6 text-center">
          <span className="text-3xl block mb-2">📥</span>
          <p className="text-sm text-text-muted">No secrets yet</p>
          <p className="text-xs text-text-muted/60 mt-1">
            Share your link on Instagram or TikTok to receive secrets
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {inbox.map((secret: any) => (
            <Link
              key={secret.id}
              to={`/s/${secret.id}`}
              className="flex items-center gap-3 bg-surface-raised rounded-xl border border-border p-3 sm:p-4 hover:border-accent/50 transition-colors active:scale-[0.98]"
            >
              <span className="text-xl">
                {secret.contentType === "text" ? "💬" : secret.contentType === "image" ? "🖼️" : "📎"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{secret.contentType} secret</p>
                <p className="text-xs text-text-muted">
                  {secret.burned ? "🔥 Burned" : secret.viewCount > 0 ? "👁️ Viewed" : "✨ New"}
                </p>
              </div>
              <span className="text-xs text-text-muted shrink-0">
                {new Date(secret.createdAt).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>
      )}

      <h2 className="text-sm font-semibold mt-8 mb-3">📤 Sent</h2>
      {sent.length === 0 ? (
        <div className="bg-surface-raised rounded-xl border border-border p-6 text-center">
          <p className="text-sm text-text-muted">No secrets sent</p>
          <Link to="/send" className="text-xs text-accent mt-1 inline-block">Send one →</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {sent.map((secret: any) => (
            <div key={secret.id} className="flex items-center gap-3 bg-surface-raised rounded-xl border border-border p-3 sm:p-4">
              <span className="text-xl">
                {secret.contentType === "text" ? "💬" : "📎"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  → {secret.recipientHandle ? `@${secret.recipientHandle}` : "Link"}
                </p>
                <p className="text-xs text-text-muted">
                  {secret.burned ? "🔥 Burned" : secret.viewCount > 0 ? `👁️ ${secret.viewCount}/${secret.maxViews}` : "⏳ Pending"}
                </p>
              </div>
              <span className="text-xs text-text-muted shrink-0">
                {new Date(secret.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
