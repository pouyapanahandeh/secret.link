import { UI_FEATURES } from "../../lib/feature-flags";
import type { UserLite } from "../../lib/users";

export type DashboardTab = "inbox" | "map" | "messages" | "profile";

export function readTabFromHash(): DashboardTab {
  if (typeof window === "undefined") return "inbox";
  const hash = window.location.hash.replace("#", "");
  if (hash === "messages" && !UI_FEATURES.messages) return "inbox";
  if (hash === "map" || hash === "profile" || hash === "inbox" || (hash === "messages" && UI_FEATURES.messages)) {
    return hash as DashboardTab;
  }
  return "inbox";
}

export type DashboardUser = {
  id: string;
  handle: string;
  email?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  socials?: { platform: string; url: string }[];
  isPro?: boolean;
  hasPasskey?: boolean;
  followersCount?: number;
  followingCount?: number;
};

export type PasskeyState = {
  status: "idle" | "loading" | "done" | "error";
  error: string;
  hasPasskey: boolean;
  onAddPasskey: () => void;
};

export type SentSecret = {
  id: string;
  contentType?: string;
  recipientHandle?: string | null;
  createdAt: string;
  viewCount?: number;
  maxViews?: number;
  burned?: boolean;
};

export function isSentUnseen(secret: SentSecret) {
  return !secret.burned && !(secret.viewCount ?? 0);
}

export function sortSentSecrets(items: SentSecret[]) {
  return [...items].sort((a, b) => {
    const unseenDelta = Number(isSentUnseen(b)) - Number(isSentUnseen(a));
    if (unseenDelta !== 0) return unseenDelta;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export type ActiveChat = {
  id: string;
  expiresAt: string;
  memberCount: number;
  maxMembers: number;
  hasPin: boolean;
  displayName: string;
  joinedAt: string;
};

export type DashboardInboxTabProps = {
  user: DashboardUser;
  inbox: unknown[];
  sent: SentSecret[];
  sentHasMore: boolean;
  sentNextOffset: number;
  activeChats: ActiveChat[];
  token: string;
  following: UserLite[];
  storyHandleSet: Set<string>;
  viewedHandles: Set<string>;
  onSelectStoryUser: (user: UserLite, hasStory: boolean) => void;
  passkey: PasskeyState;
};

export type DashboardProfileTabProps = {
  user: DashboardUser;
  editingProfile: boolean;
  bio: string;
  socials: { platform: string; url: string }[];
  avatarUrl: string | null;
  profileSaving: boolean;
  profileSaved: boolean;
  passkey: PasskeyState;
  onBioChange: (bio: string) => void;
  onSocialsChange: (socials: { platform: string; url: string }[]) => void;
  onAvatarUrlChange: (url: string | null) => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onShare: () => void;
  onStats: () => void;
  onEdit: () => void;
};

export type DashboardNavProps = {
  activeTab: DashboardTab;
  inboxCount: number;
  token: string;
  userHandle: string;
  userAvatarUrl?: string | null;
  onNavClick: (id: string) => void;
};
