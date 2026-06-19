import { useEffect, useState } from "react";
import { getApiBase } from "../lib/api.client";
import { Avatar } from "./Avatar";
import type { UserLite } from "../lib/users";

export type FollowListTab = "followers" | "following";

interface FollowListModalProps {
  token: string;
  initialTab: FollowListTab;
  onClose: () => void;
  /** Open the action sheet for a tapped user. */
  onSelectUser: (user: UserLite) => void;
}

/**
 * Modal listing the current user's followers / following. Lazily fetches each
 * tab the first time it's opened and caches the results for the session.
 */
export function FollowListModal({ token, initialTab, onClose, onSelectUser }: FollowListModalProps) {
  const [tab, setTab] = useState<FollowListTab>(initialTab);
  const [cache, setCache] = useState<Record<FollowListTab, UserLite[] | null>>({
    followers: null,
    following: null,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (cache[tab] !== null) return;
    let cancelled = false;
    setLoading(true);
    fetch(`${getApiBase()}/v1/users/me/${tab}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: UserLite[]) => {
        if (!cancelled) setCache((c) => ({ ...c, [tab]: Array.isArray(data) ? data : [] }));
      })
      .catch(() => {
        if (!cancelled) setCache((c) => ({ ...c, [tab]: [] }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, token, cache]);

  const list = cache[tab];

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Followers and following"
        className="fixed z-50 left-1/2 -translate-x-1/2 top-16 sm:top-1/2 sm:-translate-y-1/2 w-[calc(100vw-2rem)] sm:w-96 max-h-[70vh] bg-surface border border-border/50 rounded-2xl shadow-xl overflow-hidden flex flex-col"
      >
        {/* Tabs */}
        <div className="flex border-b border-border/50 shrink-0">
          {(["followers", "following"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${
                tab === t ? "text-text border-b-2 border-accent" : "text-text-muted hover:text-text"
              }`}
            >
              {t}
            </button>
          ))}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="px-4 text-text-muted hover:text-text text-xl"
          >
            ×
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto">
          {loading && list === null ? (
            <p className="px-4 py-8 text-center text-sm text-text-muted">Loading…</p>
          ) : list && list.length > 0 ? (
            list.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => onSelectUser(u)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-raised transition-colors"
              >
                <Avatar handle={u.handle} avatarUrl={u.avatarUrl} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">@{u.handle} {u.isPro && "⭐"}</p>
                  {u.bio && <p className="text-xs text-text-muted truncate">{u.bio}</p>}
                </div>
                {u.isSelf ? (
                  <span className="text-xs text-text-muted shrink-0">You</span>
                ) : u.isFollowing ? (
                  <span className="text-xs text-text-muted shrink-0">Following</span>
                ) : null}
              </button>
            ))
          ) : (
            <p className="px-4 py-8 text-center text-sm text-text-muted">
              {tab === "followers" ? "No followers yet" : "Not following anyone yet"}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
