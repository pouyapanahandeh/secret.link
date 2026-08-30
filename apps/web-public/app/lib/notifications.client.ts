// Client-side notification types + presentation helpers (DRY: single source
// of truth for how each notification type is rendered across the UI).

import { UI_FEATURES } from "./feature-flags";

export type NotificationType =
  | "message"
  | "message_read"
  | "secret"
  | "secret_read"
  | "follow"
  | "admin";

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  actorId: string | null;
  actorHandle: string | null;
  entityId: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

interface NotificationMeta {
  icon: string;
  /** Build the human-readable message for a notification. */
  message: (n: NotificationDTO) => string;
  /** Which dashboard tab to open when the notification is clicked. */
  tab: "inbox" | "messages" | "profile";
}

const actor = (n: NotificationDTO) => (n.actorHandle ? `@${n.actorHandle}` : "Someone");

export const NOTIFICATION_META: Record<NotificationType, NotificationMeta> = {
  message: {
    icon: "💬",
    message: (n) => `${actor(n)} sent you a message`,
    tab: "messages",
  },
  message_read: {
    icon: "✓",
    message: (n) => `${actor(n)} read your message`,
    tab: "messages",
  },
  secret: {
    icon: "🔒",
    message: (n) => `${actor(n)} sent you a secret`,
    tab: "inbox",
  },
  secret_read: {
    icon: "👀",
    message: (n) => `${actor(n)} opened your secret`,
    tab: "inbox",
  },
  follow: {
    icon: "➕",
    message: (n) => `${actor(n)} followed you`,
    tab: "profile",
  },
  admin: {
    icon: "🔔",
    message: (n) => {
      const body = typeof n.data?.["body"] === "string" ? n.data["body"] : "";
      const title = typeof n.data?.["title"] === "string" ? n.data["title"] : "";
      return body || title || "A message from Secretlink";
    },
    tab: "inbox",
  },
};

export function notificationMessage(n: NotificationDTO): string {
  return NOTIFICATION_META[n.type]?.message(n) ?? "New notification";
}

export function notificationIcon(n: NotificationDTO): string {
  return NOTIFICATION_META[n.type]?.icon ?? "🔔";
}

export function notificationTab(n: NotificationDTO): "inbox" | "messages" | "profile" {
  const tab = NOTIFICATION_META[n.type]?.tab ?? "inbox";
  if (!UI_FEATURES.messages && tab === "messages") return "inbox";
  return tab;
}

/** Compact relative time, e.g. "now", "5m", "3h", "2d". */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (!Number.isFinite(then) || diff < 0) return "now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString();
}
