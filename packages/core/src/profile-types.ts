/** A social link on a user profile. */
export interface ProfileSocialLink {
  platform: string;
  url: string;
}

/** Public profile data returned by GET /v1/users/:handle. */
export interface PublicProfile {
  id: string;
  handle: string;
  bio?: string | null;
  avatarUrl?: string | null;
  socials?: ProfileSocialLink[];
  isPro?: boolean;
  dmPublicKey?: string | null;
  /** All registered device public keys for multi-device inbox delivery. */
  dmPublicKeys?: string[];
  /** Whether the profile shows the "secret box" so others can send secrets. Defaults to true. */
  acceptsSecrets?: boolean;
  /** Owner-only — null for visitors. */
  followersCount?: number | null;
  /** Owner-only — null for visitors. */
  followingCount?: number | null;
}

/** Who is viewing the profile — drives which actions are shown. */
export type ProfileViewMode = "owner" | "visitor" | "guest";

export function resolveProfileViewMode(
  isLoggedIn: boolean,
  isOwnProfile: boolean,
): ProfileViewMode {
  if (isOwnProfile) return "owner";
  if (isLoggedIn) return "visitor";
  return "guest";
}
