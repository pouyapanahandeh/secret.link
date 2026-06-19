// Shared, lightweight user shape used across social UI (search results,
// follower/following lists, stories row). Mirrors the API's public user DTO.

export interface UserLite {
  id: string;
  handle: string;
  avatarUrl?: string | null;
  bio?: string | null;
  isPro?: boolean;
  isSelf?: boolean;
  isFollowing?: boolean;
}

/** Deterministic accent initial for avatar fallbacks. */
export function handleInitial(handle: string): string {
  return (handle?.[0] ?? "?").toUpperCase();
}
