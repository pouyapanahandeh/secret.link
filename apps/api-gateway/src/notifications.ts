import { nanoid } from "nanoid";
import db from "./db.js";
import { SSEHub } from "./lib/sse.js";
import webpush from "web-push";
import { logger } from "./middleware/logger.js";

/** Notification categories emitted across the app. */
export type NotificationType =
  | "message" // received a DM
  | "message_read" // your DM was read
  | "secret" // received a secret
  | "secret_read" // your secret was read
  | "follow"; // someone followed you

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  actor_id: string | null;
  actor_handle: string | null;
  entity_id: string | null;
  data: string | null;
  read: number;
  created_at: string;
}

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

/** Shared SSE hub for user-scoped notification streams (channel = userId). */
export const notificationsHub = new SSEHub();

// ─── Web Push (VAPID) ───────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY = process.env["VAPID_PUBLIC_KEY"] ?? "";
const VAPID_PRIVATE_KEY = process.env["VAPID_PRIVATE_KEY"] ?? "";
const VAPID_SUBJECT = process.env["VAPID_SUBJECT"] ?? "mailto:admin@secretlink.life";
const pushEnabled = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (pushEnabled) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

/** The VAPID public key clients use to subscribe (empty string if disabled). */
export function getVapidPublicKey(): string {
  return pushEnabled ? VAPID_PUBLIC_KEY : "";
}

const pushStmts = {
  upsert: db.prepare(
    `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
  ),
  listByUser: db.prepare(`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?`),
  deleteByEndpoint: db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`),
};

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Persist (or refresh) a browser push subscription for a user. */
export function savePushSubscription(userId: string, sub: PushSubscriptionInput): void {
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return;
  pushStmts.upsert.run(sub.endpoint, userId, sub.keys.p256dh, sub.keys.auth, new Date().toISOString());
}

/** Remove a push subscription by its endpoint. */
export function deletePushSubscription(endpoint: string): void {
  if (endpoint) pushStmts.deleteByEndpoint.run(endpoint);
}

/** Human-readable push copy for each notification type. */
function pushCopy(dto: NotificationDTO): { title: string; body: string } {
  const who = dto.actorHandle ? `@${dto.actorHandle}` : "Someone";
  switch (dto.type) {
    case "message":
      return { title: "New message", body: `${who} sent you a message` };
    case "message_read":
      return { title: "Message read", body: `${who} read your message` };
    case "secret":
      return { title: "New secret", body: "Someone sent you a secret 🔒" };
    case "secret_read":
      return { title: "Secret opened", body: "Someone opened your secret 👀" };
    case "follow":
      return { title: "New follower", body: `${who} followed you` };
    default:
      return { title: "Secretlink", body: "You have a new notification" };
  }
}

/**
 * Fan a notification out to all of a user's registered push subscriptions so it
 * appears on their lock screen / browser even when the app is closed. Stale
 * subscriptions (410/404) are pruned. Best-effort: never throws.
 */
function sendWebPush(userId: string, dto: NotificationDTO): void {
  if (!pushEnabled) return;
  const subs = pushStmts.listByUser.all(userId) as Array<{ endpoint: string; p256dh: string; auth: string }>;
  if (subs.length === 0) return;

  const { title, body } = pushCopy(dto);
  const payload = JSON.stringify({
    title,
    body,
    tab: NOTIFICATION_TAB[dto.type] ?? "inbox",
    notificationId: dto.id,
  });

  for (const s of subs) {
    webpush
      .sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      )
      .then((res) => {
        logger.info(
          { userId, type: dto.type, statusCode: res.statusCode, endpoint: s.endpoint.slice(0, 60) },
          "web-push sent",
        );
      })
      .catch((err: unknown) => {
        const code = (err as { statusCode?: number })?.statusCode;
        const bodyText = (err as { body?: string })?.body;
        if (code === 404 || code === 410) {
          deletePushSubscription(s.endpoint);
          logger.info({ userId, statusCode: code, endpoint: s.endpoint.slice(0, 60) }, "web-push subscription pruned");
        } else {
          logger.warn(
            { userId, type: dto.type, statusCode: code, body: bodyText, endpoint: s.endpoint.slice(0, 60) },
            "web-push send failed",
          );
        }
      });
  }
}

/** Which dashboard tab each notification type should deep-link to. */
const NOTIFICATION_TAB: Record<NotificationType, "inbox" | "messages" | "profile"> = {
  message: "messages",
  message_read: "messages",
  secret: "inbox",
  secret_read: "inbox",
  follow: "profile",
};

const stmts = {
  insert: db.prepare(
    `INSERT INTO notifications (id, user_id, type, actor_id, actor_handle, entity_id, data, read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
  ),
  list: db.prepare(
    `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
  ),
  countUnread: db.prepare(
    `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read = 0`,
  ),
  markRead: db.prepare(
    `UPDATE notifications SET read = 1 WHERE user_id = ? AND id = ?`,
  ),
  markAllRead: db.prepare(
    `UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0`,
  ),
  getUserIdByHandle: db.prepare(`SELECT id FROM users WHERE handle = ?`),
};

function toDTO(row: NotificationRow): NotificationDTO {
  return {
    id: row.id,
    type: row.type,
    actorId: row.actor_id,
    actorHandle: row.actor_handle,
    entityId: row.entity_id,
    data: row.data ? JSON.parse(row.data) : null,
    read: !!row.read,
    createdAt: row.created_at,
  };
}

export interface CreateNotificationInput {
  /** Recipient user id. */
  userId: string;
  type: NotificationType;
  actorId?: string | null;
  actorHandle?: string | null;
  entityId?: string | null;
  data?: Record<string, unknown> | null;
}

/**
 * Persist a notification and push it live to the recipient's SSE stream.
 * No-op when the recipient would be notified about their own action.
 */
export function createNotification(input: CreateNotificationInput): NotificationDTO | null {
  if (!input.userId) return null;
  // Never notify a user about their own action.
  if (input.actorId && input.actorId === input.userId) return null;

  const row: NotificationRow = {
    id: nanoid(),
    user_id: input.userId,
    type: input.type,
    actor_id: input.actorId ?? null,
    actor_handle: input.actorHandle ?? null,
    entity_id: input.entityId ?? null,
    data: input.data ? JSON.stringify(input.data) : null,
    read: 0,
    created_at: new Date().toISOString(),
  };

  stmts.insert.run(
    row.id,
    row.user_id,
    row.type,
    row.actor_id,
    row.actor_handle,
    row.entity_id,
    row.data,
    row.created_at,
  );

  const dto = toDTO(row);
  const unreadCount = countUnread(input.userId);
  notificationsHub.notify(input.userId, "notification", { notification: dto, unreadCount });
  sendWebPush(input.userId, dto);
  return dto;
}

export function listNotifications(userId: string, limit = 50): NotificationDTO[] {
  const rows = stmts.list.all(userId, Math.min(Math.max(limit, 1), 100)) as NotificationRow[];
  return rows.map(toDTO);
}

export function countUnread(userId: string): number {
  return (stmts.countUnread.get(userId) as { count: number } | undefined)?.count ?? 0;
}

export function markRead(userId: string, id: string): void {
  stmts.markRead.run(userId, id);
}

export function markAllRead(userId: string): void {
  stmts.markAllRead.run(userId);
}

/** Resolve a user id from a handle (used when only the handle is known). */
export function getUserIdByHandle(handle: string): string | null {
  const row = stmts.getUserIdByHandle.get(handle) as { id: string } | undefined;
  return row?.id ?? null;
}
