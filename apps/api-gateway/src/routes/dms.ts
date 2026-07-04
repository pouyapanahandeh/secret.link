import Router from "@koa/router";
import type { Context } from "koa";
import { nanoid } from "nanoid";
import { requireAuth, type AuthPayload } from "../middleware/auth.js";
import { dmRateLimiter } from "../middleware/rate-limiter.js";
import db from "../db.js";
import { createNotification } from "../notifications.js";

export const dmsRouter = new Router({ prefix: "/dms" });

// ─── SSE ticket management (short-lived tokens for EventSource) ─────────────
const sseTickets = new Map<string, { userId: string; conversationId: string; expiresAt: number }>();

// Clean expired tickets periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of sseTickets) {
    if (now > val.expiresAt) sseTickets.delete(key);
  }
}, 60_000);

// ─── SSE client management ──────────────────────────────────────────────────
interface SSEClient {
  userId: string;
  conversationId: string;
  write: (event: string, data: any) => void;
  close: () => void;
}

const sseClients = new Set<SSEClient>();

export function notifyConversation(conversationId: string, event: string, data: any, excludeUserId?: string) {
  for (const client of sseClients) {
    if (client.conversationId === conversationId && client.userId !== excludeUserId) {
      client.write(event, data);
    }
  }
}

// ─── Prepared statements ────────────────────────────────────────────────────
const stmts = {
  upsertKey: db.prepare(`INSERT INTO dm_keys (user_id, public_key) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET public_key = excluded.public_key`),
  getKey: db.prepare(`SELECT public_key FROM dm_keys WHERE user_id = ?`),
  findConversation: db.prepare(`SELECT * FROM conversations WHERE (participant1_id = ? AND participant2_id = ?) OR (participant1_id = ? AND participant2_id = ?)`),
  insertConversation: db.prepare(`INSERT INTO conversations (id, participant1_id, participant1_handle, participant2_id, participant2_handle, created_at, last_message_at) VALUES (?, ?, ?, ?, ?, ?, ?)`),
  getConversation: db.prepare(`SELECT * FROM conversations WHERE id = ?`),
  listConversations: db.prepare(`SELECT * FROM conversations WHERE participant1_id = ? OR participant2_id = ? ORDER BY last_message_at DESC`),
  updateLastMessage: db.prepare(`UPDATE conversations SET last_message_at = ? WHERE id = ?`),
  insertMessage: db.prepare(`INSERT INTO dm_messages (id, conversation_id, sender_id, sender_handle, recipient_id, encrypted_content, nonce, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  getMessages: db.prepare(`SELECT * FROM dm_messages WHERE conversation_id = ? AND expires_at > ? ORDER BY created_at ASC`),
  markRead: db.prepare(`UPDATE dm_messages SET read_at = ? WHERE conversation_id = ? AND recipient_id = ? AND read_at IS NULL`),
  deleteExpired: db.prepare(`DELETE FROM dm_messages WHERE expires_at <= ?`),
};

// ─── Register public key (for E2E encryption) ──────────────────────────────
dmsRouter.post("/keys", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  const body = ctx.request.body as Record<string, unknown>;
  const publicKey = String(body.publicKey ?? "").trim();

  if (!publicKey) {
    ctx.status = 400;
    ctx.body = { error: "Public key required" };
    return;
  }

  stmts.upsertKey.run(auth.userId, publicKey);
  ctx.body = { ok: true };
});

// ─── Get a user's public key ────────────────────────────────────────────────
dmsRouter.get("/keys/:userId", requireAuth(), async (ctx: Context) => {
  const userId = ctx.params["userId"]!;
  const row = stmts.getKey.get(userId) as any;

  if (!row) {
    ctx.status = 404;
    ctx.body = { error: "User has no encryption key" };
    return;
  }

  ctx.body = { publicKey: row.public_key };
});

// ─── Start or get conversation ──────────────────────────────────────────────
dmsRouter.post("/conversations", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  const body = ctx.request.body as Record<string, unknown>;
  const recipientId = String(body.recipientId ?? "").trim();

  if (!recipientId) {
    ctx.status = 400;
    ctx.body = { error: "Recipient required" };
    return;
  }

  if (recipientId === auth.userId) {
    ctx.status = 400;
    ctx.body = { error: "Cannot message yourself" };
    return;
  }

  // Look up recipient handle from DB (don't trust client)
  const recipientUser = db.prepare(`SELECT handle FROM users WHERE id = ?`).get(recipientId) as any;
  if (!recipientUser) {
    ctx.status = 404;
    ctx.body = { error: "Recipient not found" };
    return;
  }
  const recipientHandle = recipientUser.handle;

  // Check if conversation already exists
  const existing = stmts.findConversation.get(auth.userId, recipientId, recipientId, auth.userId) as any;
  if (existing) {
    ctx.body = convRowToResponse(existing);
    return;
  }

  const now = new Date().toISOString();
  const id = nanoid();
  stmts.insertConversation.run(id, auth.userId, auth.handle, recipientId, recipientHandle, now, now);

  ctx.status = 201;
  ctx.body = {
    id,
    participantIds: [auth.userId, recipientId],
    participantHandles: [auth.handle, recipientHandle],
    createdAt: now,
    lastMessageAt: now,
  };
});

// ─── List user's conversations ──────────────────────────────────────────────
dmsRouter.get("/conversations", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  const rows = stmts.listConversations.all(auth.userId, auth.userId) as any[];
  ctx.body = rows.map(convRowToResponse);
});

// ─── Send encrypted message ─────────────────────────────────────────────────
dmsRouter.post("/conversations/:id/messages", requireAuth(), dmRateLimiter(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  const convId = ctx.params["id"]!;
  const conv = stmts.getConversation.get(convId) as any;

  if (!conv || (conv.participant1_id !== auth.userId && conv.participant2_id !== auth.userId)) {
    ctx.status = 404;
    ctx.body = { error: "Conversation not found" };
    return;
  }

  const body = ctx.request.body as Record<string, unknown>;
  const encryptedContent = String(body.encryptedContent ?? "").trim();
  const nonce = String(body.nonce ?? "").trim();
  const ttlMinutes = Math.min(Math.max(Number(body.ttlMinutes) || 5, 1), 1440);

  if (!encryptedContent || !nonce) {
    ctx.status = 400;
    ctx.body = { error: "Encrypted content and nonce required" };
    return;
  }

  const recipientId = conv.participant1_id === auth.userId ? conv.participant2_id : conv.participant1_id;
  const now = new Date();
  const id = nanoid();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();

  stmts.insertMessage.run(id, convId, auth.userId, auth.handle, recipientId, encryptedContent, nonce, createdAt, expiresAt);
  stmts.updateLastMessage.run(createdAt, convId);

  const msgResponse = { id, conversationId: convId, senderId: auth.userId, senderHandle: auth.handle, recipientId, encryptedContent, nonce, createdAt, expiresAt };

  // Notify SSE clients
  notifyConversation(convId, "new_message", msgResponse);

  // Persist a notification for the recipient (live push + history)
  createNotification({
    userId: recipientId,
    type: "message",
    actorId: auth.userId,
    actorHandle: auth.handle,
    entityId: convId,
  });

  ctx.status = 201;
  ctx.body = msgResponse;
});

// ─── Get conversation messages ──────────────────────────────────────────────
dmsRouter.get("/conversations/:id/messages", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  const convId = ctx.params["id"]!;
  const conv = stmts.getConversation.get(convId) as any;

  if (!conv || (conv.participant1_id !== auth.userId && conv.participant2_id !== auth.userId)) {
    ctx.status = 404;
    ctx.body = { error: "Conversation not found" };
    return;
  }

  const now = new Date().toISOString();
  const since = ctx.query["since"] as string | undefined;
  const before = ctx.query["before"] as string | undefined;
  const limit = Math.min(Math.max(Number(ctx.query["limit"]) || 50, 1), 200);

  // Clean up expired
  stmts.deleteExpired.run(now);

  // Mark unread as read and notify sender
  const unreadBefore = db.prepare(`SELECT id, sender_id FROM dm_messages WHERE conversation_id = ? AND recipient_id = ? AND read_at IS NULL`).all(convId, auth.userId) as any[];
  stmts.markRead.run(now, convId, auth.userId);
  if (unreadBefore.length > 0) {
    const messageIds = unreadBefore.map((r: any) => r.id);
    notifyConversation(convId, "messages_read", { messageIds, readAt: now }, auth.userId);

    // Notify each distinct sender that their message(s) were read
    const senderIds = [...new Set(unreadBefore.map((r: any) => r.sender_id as string))];
    for (const senderId of senderIds) {
      createNotification({
        userId: senderId,
        type: "message_read",
        actorId: auth.userId,
        actorHandle: auth.handle,
        entityId: convId,
      });
    }
  }

  let rows: any[];
  if (since) {
    rows = db.prepare(`SELECT * FROM dm_messages WHERE conversation_id = ? AND expires_at > ? AND created_at > ? ORDER BY created_at ASC LIMIT ?`).all(convId, now, since, limit);
  } else if (before) {
    rows = db.prepare(`SELECT * FROM dm_messages WHERE conversation_id = ? AND expires_at > ? AND created_at < ? ORDER BY created_at DESC LIMIT ?`).all(convId, now, before, limit);
    rows.reverse(); // Return in chronological order
  } else {
    rows = db.prepare(`SELECT * FROM dm_messages WHERE conversation_id = ? AND expires_at > ? ORDER BY created_at DESC LIMIT ?`).all(convId, now, limit);
    rows.reverse(); // Return in chronological order (most recent page, oldest first)
  }

  ctx.body = rows.map(r => ({
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    senderHandle: r.sender_handle,
    recipientId: r.recipient_id,
    encryptedContent: r.encrypted_content,
    nonce: r.nonce,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    readAt: r.read_at,
  }));
});

// ─── Unread message count ───────────────────────────────────────────────────
dmsRouter.get("/unread", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  const now = new Date().toISOString();
  stmts.deleteExpired.run(now);
  const row = db.prepare(`SELECT COUNT(*) as count FROM dm_messages WHERE recipient_id = ? AND read_at IS NULL AND expires_at > ?`).get(auth.userId, now) as any;
  ctx.body = { count: row?.count ?? 0 };
});

// ─── Delete conversation ────────────────────────────────────────────────────
dmsRouter.delete("/conversations/:id", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  const convId = ctx.params["id"]!;
  const conv = stmts.getConversation.get(convId) as any;

  if (!conv || (conv.participant1_id !== auth.userId && conv.participant2_id !== auth.userId)) {
    ctx.status = 404;
    ctx.body = { error: "Conversation not found" };
    return;
  }

  db.prepare(`DELETE FROM dm_messages WHERE conversation_id = ?`).run(convId);
  db.prepare(`DELETE FROM conversations WHERE id = ?`).run(convId);
  ctx.body = { ok: true };
});

// ─── Delete a message ───────────────────────────────────────────────────────
dmsRouter.delete("/conversations/:id/messages/:msgId", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  const convId = ctx.params["id"]!;
  const msgId = ctx.params["msgId"]!;

  const conv = stmts.getConversation.get(convId) as any;
  if (!conv || (conv.participant1_id !== auth.userId && conv.participant2_id !== auth.userId)) {
    ctx.status = 404;
    ctx.body = { error: "Conversation not found" };
    return;
  }

  const msg = db.prepare(`SELECT * FROM dm_messages WHERE id = ? AND conversation_id = ?`).get(msgId, convId) as any;
  if (!msg) {
    ctx.status = 404;
    ctx.body = { error: "Message not found" };
    return;
  }

  // Only sender can delete their message
  if (msg.sender_id !== auth.userId) {
    ctx.status = 403;
    ctx.body = { error: "Can only delete your own messages" };
    return;
  }

  db.prepare(`DELETE FROM dm_messages WHERE id = ?`).run(msgId);

  // Notify SSE clients about deletion
  notifyConversation(convId, "message_deleted", { messageId: msgId });

  ctx.body = { ok: true };
});

// ─── Typing indicator ───────────────────────────────────────────────────────
dmsRouter.post("/conversations/:id/typing", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  const convId = ctx.params["id"]!;
  const conv = stmts.getConversation.get(convId) as any;

  if (!conv || (conv.participant1_id !== auth.userId && conv.participant2_id !== auth.userId)) {
    ctx.status = 404;
    ctx.body = { error: "Conversation not found" };
    return;
  }

  notifyConversation(convId, "typing", { userId: auth.userId, handle: auth.handle }, auth.userId);
  ctx.body = { ok: true };
});

// ─── SSE Stream ─────────────────────────────────────────────────────────────
// Issue a short-lived ticket for SSE (since EventSource can't set headers)
dmsRouter.post("/stream-ticket", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  const body = ctx.request.body as Record<string, unknown>;
  const conversationId = String(body.conversationId ?? "").trim();

  if (!conversationId) {
    ctx.status = 400;
    ctx.body = { error: "conversationId required" };
    return;
  }

  // Verify user is participant
  const conv = stmts.getConversation.get(conversationId) as any;
  if (!conv || (conv.participant1_id !== auth.userId && conv.participant2_id !== auth.userId)) {
    ctx.status = 404;
    ctx.body = { error: "Conversation not found" };
    return;
  }

  const ticket = nanoid(32);
  sseTickets.set(ticket, {
    userId: auth.userId,
    conversationId,
    expiresAt: Date.now() + 30_000, // 30-second expiry
  });

  ctx.body = { ticket };
});

dmsRouter.get("/stream", async (ctx: Context) => {
  // Auth via short-lived, single-use ticket only. Long-lived JWTs are never
  // accepted in the query string (they would leak into logs and history).
  const ticketParam = ctx.query["ticket"] as string;

  if (!ticketParam) {
    ctx.status = 400;
    ctx.body = { error: "ticket_required" };
    return;
  }

  const ticketData = sseTickets.get(ticketParam);
  if (!ticketData || Date.now() > ticketData.expiresAt) {
    ctx.status = 401;
    ctx.body = { error: "invalid_or_expired_ticket" };
    return;
  }
  const userId = ticketData.userId;
  const conversationId = ticketData.conversationId;
  sseTickets.delete(ticketParam); // one-time use

  // Verify user is participant of this conversation
  const conv = stmts.getConversation.get(conversationId) as any;
  if (!conv || (conv.participant1_id !== userId && conv.participant2_id !== userId)) {
    ctx.status = 404;
    ctx.body = { error: "Conversation not found" };
    return;
  }

  // Set up SSE
  ctx.req.socket.setKeepAlive(true);
  ctx.req.socket.setNoDelay(true);
  ctx.set("Content-Type", "text/event-stream");
  ctx.set("Cache-Control", "no-cache");
  ctx.set("Connection", "keep-alive");
  ctx.set("X-Accel-Buffering", "no"); // Disable nginx buffering
  ctx.status = 200;

  const stream = ctx.res;
  stream.write("event: connected\ndata: {}\n\n");

  const client: SSEClient = {
    userId,
    conversationId,
    write: (event: string, data: any) => {
      try { stream.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
    },
    close: () => { sseClients.delete(client); },
  };
  sseClients.add(client);

  // Keep alive ping every 30s
  const keepAlive = setInterval(() => {
    try { stream.write(": ping\n\n"); } catch { clearInterval(keepAlive); client.close(); }
  }, 30000);

  // Clean up on disconnect
  ctx.req.on("close", () => {
    clearInterval(keepAlive);
    client.close();
  });

  // Keep the connection open (don't call next, don't end response)
  await new Promise(() => {}); // Never resolves — connection stays open until client disconnects
});

// ─── Helpers ────────────────────────────────────────────────────────────────
function convRowToResponse(row: any) {
  return {
    id: row.id,
    participantIds: [row.participant1_id, row.participant2_id],
    participantHandles: [row.participant1_handle, row.participant2_handle],
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
  };
}
