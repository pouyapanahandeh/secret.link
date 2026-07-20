import type { ProfileViewMode, PublicProfile } from "@secretlink/core/profile-types";
import { UI_FEATURES } from "@secretlink/core/feature-flags";
import { getSocialLinkUrl } from "@secretlink/core/profile-url";
import { getSocialMeta } from "../lib/socials";
import { SocialIcon } from "./SocialIcon";

export interface ProfileViewProps {
  profile: PublicProfile | null;
  handle: string;
  mode: ProfileViewMode;
  apiBase: string;
  followersCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
  onFollow?: () => void;
  onFollowersClick?: () => void;
  onFollowingClick?: () => void;
  onShare?: () => void;
  onStats?: () => void;
  onEdit?: () => void;
}

export function ProfileView({
  profile,
  handle,
  mode,
  apiBase,
  followersCount = 0,
  followingCount = 0,
  isFollowing = false,
  onFollow,
  onFollowersClick,
  onFollowingClick,
  onShare,
  onStats,
  onEdit,
}: ProfileViewProps) {
  const isOwner = mode === "owner";
  const isVisitor = mode === "visitor";

  return (
    <div className="mb-6">
      <div className="flex gap-4 items-start">
        <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-full bg-accent/20 border-2 border-accent flex items-center justify-center overflow-hidden">
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={`@${handle}`}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span className="text-2xl sm:text-3xl font-bold text-accent">
              {(handle ?? "?")[0]?.toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold">@{handle}</h1>
              {profile?.isPro && (
                <span className="inline-flex items-center gap-1 text-xs bg-accent/10 text-accent px-2.5 py-0.5 rounded-full">
                  ⭐ Pro
                </span>
              )}
            </div>
            {isOwner && onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="shrink-0 text-sm font-semibold text-accent hover:text-accent/80 transition-colors pt-0.5"
              >
                Edit
              </button>
            )}
          </div>

          {isOwner && (
            <div className="flex items-center gap-4 mt-2">
              <button
                type="button"
                onClick={onFollowersClick}
                className="text-left hover:opacity-80 transition-opacity"
              >
                <span className="text-sm font-bold text-text">{followersCount}</span>
                <span className="text-xs text-text-muted ml-1">followers</span>
              </button>
              <button
                type="button"
                onClick={onFollowingClick}
                className="text-left hover:opacity-80 transition-opacity"
              >
                <span className="text-sm font-bold text-text">{followingCount}</span>
                <span className="text-xs text-text-muted ml-1">following</span>
              </button>
            </div>
          )}

          {profile?.bio ? (
            <p className="text-text-muted mt-2 text-sm leading-relaxed whitespace-pre-wrap">
              {profile.bio}
            </p>
          ) : isOwner ? (
            <p className="text-text-muted/50 mt-2 text-sm italic">No bio yet</p>
          ) : null}

          {profile?.socials && profile.socials.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {profile.socials.map((s, i) => {
                const meta = getSocialMeta(s.platform);
                const href = isOwner ? s.url : getSocialLinkUrl(handle, s.platform, apiBase);
                return (
                  <a
                    key={i}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-surface-raised border border-border px-3 py-1.5 hover:border-accent/50 hover:scale-[1.02] transition-all"
                    title={s.url}
                  >
                    <SocialIcon platform={s.platform} size={16} />
                    <span className="text-xs font-medium">{meta.label}</span>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isOwner && (onShare || onStats) && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              className="group flex flex-col items-center rounded-2xl border border-border/60 bg-surface-raised px-3 py-5 text-center transition-all hover:border-accent/40 hover:bg-surface-raised/80 active:scale-[0.98]"
            >
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-accent transition-colors group-hover:bg-accent/25">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="text-sm font-bold text-text">Share profile</span>
              <span className="mt-0.5 text-[11px] text-text-muted">Copy link or QR</span>
            </button>
          )}
          {onStats && (
            <button
              type="button"
              onClick={onStats}
              className="group flex flex-col items-center rounded-2xl border border-border/60 bg-surface-raised px-3 py-5 text-center transition-all hover:border-accent/40 hover:bg-surface-raised/80 active:scale-[0.98]"
            >
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-text transition-colors group-hover:border-accent/30">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 19V9M12 19V5M19 19v-7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className="text-sm font-bold text-text">Statistics</span>
              <span className="mt-0.5 text-[11px] text-text-muted">Views & activity</span>
            </button>
          )}
        </div>
      )}

      {isVisitor && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <button
              type="button"
              onClick={onFollow}
              className={`text-xs px-5 py-2 rounded-full font-semibold transition-all ${
                isFollowing
                  ? "bg-surface-raised border border-border text-text-muted hover:border-red-400/50 hover:text-red-400"
                  : "bg-accent text-black hover:scale-[1.02]"
              }`}
            >
              {isFollowing ? "Following ✓" : "Follow"}
            </button>
            {UI_FEATURES.messages && (
              <a
                href={`/messages?to=${profile?.handle ?? handle}`}
                className="inline-flex items-center gap-2 text-xs bg-surface-raised border border-border hover:border-accent/50 text-text px-5 py-2 rounded-full transition-colors"
              >
                🔒 Message
              </a>
            )}
        </div>
      )}
    </div>
  );
}
