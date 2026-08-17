import Router from "@koa/router";
import type { Context } from "koa";
import { requireAuth, type AuthPayload } from "../middleware/auth.js";
import {
  notificationsHub,
  listNotificationsPage,
  countNotifications,
  countUnread,
  markRead,
  markAllRead,
  getVapidPublicKey,
  savePushSubscription,
  deletePushSubscription,
} from "../notifications.js";

export const notificationsRouter = new Router({ prefix: "/notifications" });

// ─── List notifications ─────────────────────────────────────────────────────
notificationsRouter.get("/", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  const limit = Math.min(Math.max(Number(ctx.query["limit"]) || 50, 1), 50);
  const offset = Math.max(Number(ctx.query["offset"]) || 0, 0);
  const items = listNotificationsPage(auth.userId, limit, offset);
  const total = countNotifications(auth.userId);
  const nextOffset = offset + items.length;
  ctx.body = {
    notifications: items,
    unreadCount: countUnread(auth.userId),
    hasMore: nextOffset < total,
    nextOffset,
    total,
  };
});

// ─── Unread count ───────────────────────────────────────────────────────────
notificationsRouter.get("/unread-count", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  ctx.body = { unreadCount: countUnread(auth.userId) };
});

// ─── Mark read (single or all) ──────────────────────────────────────────────
notificationsRouter.post("/read", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  const body = ctx.request.body as Record<string, unknown>;
  const id = body.id ? String(body.id) : null;

  if (id) {
    markRead(auth.userId, id);
  } else {
    markAllRead(auth.userId);
  }

  ctx.body = { ok: true, unreadCount: countUnread(auth.userId) };
});

// ─── Web Push: VAPID public key (clients need it to subscribe) ──────────────
notificationsRouter.get("/vapid-public-key", async (ctx: Context) => {
  ctx.body = { publicKey: getVapidPublicKey() };
});

// ─── Web Push: register a browser subscription ──────────────────────────────
notificationsRouter.post("/subscribe", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  const body = ctx.request.body as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    ctx.status = 400;
    ctx.body = { error: "invalid_subscription" };
    return;
  }
  savePushSubscription(auth.userId, {
    endpoint: body.endpoint,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
  });
  ctx.body = { ok: true };
});

// ─── Web Push: remove a browser subscription ────────────────────────────────
notificationsRouter.post("/unsubscribe", requireAuth(), async (ctx: Context) => {
  const body = ctx.request.body as { endpoint?: string };
  if (body?.endpoint) deletePushSubscription(body.endpoint);
  ctx.body = { ok: true };
});

// ─── SSE stream ticket ──────────────────────────────────────────────────────
notificationsRouter.post("/stream-ticket", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  // Channel is the user's own id — they only receive their own notifications.
  const ticket = notificationsHub.issueTicket(auth.userId, auth.userId);
  ctx.body = { ticket };
});

// ─── SSE stream ─────────────────────────────────────────────────────────────
notificationsRouter.get("/stream", async (ctx: Context) => {
  const ticket = ctx.query["ticket"] as string | undefined;
  if (!ticket) {
    ctx.status = 400;
    ctx.body = { error: "ticket_required" };
    return;
  }

  const resolved = notificationsHub.consumeTicket(ticket);
  if (!resolved) {
    ctx.status = 401;
    ctx.body = { error: "invalid_or_expired_ticket" };
    return;
  }

  await notificationsHub.attach(ctx, resolved.channel, resolved.userId);
});
