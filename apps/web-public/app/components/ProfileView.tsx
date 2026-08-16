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
  onSettings?: () => void;
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
  onSettings,
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
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">@{handle}</h1>
              {profile?.isPro && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.16em] uppercase bg-accent text-black px-2.5 py-0.5 rounded-full font-semibold">
                  Pro
                </span>
              )}
            </div>
            {isOwner && (onEdit || onSettings) && (
              <div className="shrink-0 flex items-center gap-3 pt-0.5">
                {onEdit && (
                  <button
                    type="button"
                    onClick={onEdit}
                    className="font-mono text-[10px] tracking-[0.16em] uppercase font-semibold text-accent hover:text-accent/80 transition-colors"
                  >
                    Edit
                  </button>
                )}
                {onSettings && (
                  <button
                    type="button"
                    onClick={onSettings}
                    aria-label="Profile settings"
                    title="Settings"
                    className="text-text-muted hover:text-text transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          {isOwner && (
            <div className="flex items-center gap-4 mt-2">
              <button
                type="button"
                onClick={onFollowersClick}
                className="text-left hover:opacity-80 transition-opacity"
              >
                <span className="text-sm font-extrabold text-text">{followersCount}</span>
                <span className="font-mono text-[10px] tracking-wide uppercase text-text-muted ml-1">followers</span>
              </button>
              <button
                type="button"
                onClick={onFollowingClick}
                className="text-left hover:opacity-80 transition-opacity"
              >
                <span className="text-sm font-extrabold text-text">{followingCount}</span>
                <span className="font-mono text-[10px] tracking-wide uppercase text-text-muted ml-1">following</span>
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
        <div className="mt-5 grid grid-cols-2 gap-px bg-border border border-border">
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              className="group flex flex-col items-center bg-accent px-3 py-5 text-center text-black transition-colors hover:bg-accent-soft"
            >
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-black text-accent">
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
              <span className="text-sm font-extrabold">Share profile</span>
              <span className="mt-0.5 font-mono text-[10px] tracking-wide uppercase text-black/60">Copy link or QR</span>
            </button>
          )}
          {onStats && (
            <button
              type="button"
              onClick={onStats}
              className="group flex flex-col items-center bg-surface-raised px-3 py-5 text-center transition-colors hover:bg-surface"
            >
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-text">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 19V9M12 19V5M19 19v-7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className="text-sm font-extrabold text-text">Statistics</span>
              <span className="mt-0.5 font-mono text-[10px] tracking-wide uppercase text-text-muted">Views & activity</span>
            </button>
          )}
        </div>
      )}

      {isVisitor && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <button
              type="button"
              onClick={onFollow}
              className={`text-xs px-5 py-2 rounded-full font-extrabold transition-colors ${
                isFollowing
                  ? "bg-surface-raised border border-border text-text-muted hover:border-red-400/50 hover:text-red-400"
                  : "bg-accent text-black hover:bg-accent-soft"
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
