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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-xl sm:text-2xl font-bold">@{handle}</h1>
            {profile?.isPro && (
              <span className="inline-flex items-center gap-1 text-xs bg-accent/10 text-accent px-2.5 py-0.5 rounded-full">
                ⭐ Pro
              </span>
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

      <div className="flex flex-wrap items-center gap-2 mt-4">
        {isOwner && onShare && (
          <button
            type="button"
            onClick={onShare}
            className="rounded-full bg-surface-raised border border-border px-4 py-2 text-xs font-semibold text-text hover:border-accent/50 transition-all"
          >
            Share profile
          </button>
        )}
        {isOwner && onStats && (
          <button
            type="button"
            onClick={onStats}
            className="rounded-full bg-surface-raised border border-border px-4 py-2 text-xs font-semibold text-text hover:border-accent/50 transition-all"
          >
            Statistics
          </button>
        )}
        {isOwner && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full bg-surface-raised border border-border px-4 py-2 text-xs font-semibold text-text hover:border-accent/50 transition-all"
          >
            ✏️ Edit profile
          </button>
        )}
        {isVisitor && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
