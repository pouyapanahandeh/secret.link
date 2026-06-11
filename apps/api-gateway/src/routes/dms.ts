import Router from "@koa/router";
import type { Context } from "koa";
import { nanoid } from "nanoid";
import { requireAuth, type AuthPayload } from "../middleware/auth.js";

export const dmsRouter = new Router({ prefix: "/dms" });

// ─── In-memory stores ───────────────────────────────────────────────────────
interface DmMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderHandle: string;
  recipientId: string;
  encryptedContent: string; // Encrypted with recipient's public key
  nonce: string;
  createdAt: string;
  expiresAt: string; // Disappearing mechanism
  readAt?: string;
}

interface Conversation {
  id: string;
  participantIds: [string, string];
  participantHandles: [string, string];
  createdAt: string;
  lastMessageAt: string;
}

interface PublicKey {
  userId: string;
  publicKey: string; // Base64-encoded X25519 public key
}

const conversations = new Map<string, Conversation>();
const messages = new Map<string, DmMessage[]>(); // conversationId -> messages
const publicKeys = new Map<string, PublicKey>(); // userId -> public key

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

  publicKeys.set(auth.userId, { userId: auth.userId, publicKey });
  ctx.body = { ok: true };
});

// ─── Get a user's public key ────────────────────────────────────────────────
dmsRouter.get("/keys/:userId", async (ctx: Context) => {
  const userId = ctx.params["userId"]!;
  const key = publicKeys.get(userId);

  if (!key) {
    ctx.status = 404;
    ctx.body = { error: "User has no encryption key" };
    return;
  }

  ctx.body = { publicKey: key.publicKey };
});

// ─── Start or get conversation ──────────────────────────────────────────────
dmsRouter.post("/conversations", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  const body = ctx.request.body as Record<string, unknown>;
  const recipientId = String(body.recipientId ?? "").trim();
  const recipientHandle = String(body.recipientHandle ?? "").trim();

  if (!recipientId || !recipientHandle) {
    ctx.status = 400;
    ctx.body = { error: "Recipient required" };
    return;
  }

  if (recipientId === auth.userId) {
    ctx.status = 400;
    ctx.body = { error: "Cannot message yourself" };
    return;
  }

  // Check if conversation already exists
  for (const conv of conversations.values()) {
    if (
      conv.participantIds.includes(auth.userId) &&
      conv.participantIds.includes(recipientId)
    ) {
      ctx.body = conv;
      return;
    }
  }

  const conv: Conversation = {
    id: nanoid(),
    participantIds: [auth.userId, recipientId],
    participantHandles: [auth.handle, recipientHandle],
    createdAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
  };

  conversations.set(conv.id, conv);
  messages.set(conv.id, []);
  ctx.status = 201;
  ctx.body = conv;
});

// ─── List user's conversations ──────────────────────────────────────────────
dmsRouter.get("/conversations", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  const result: Conversation[] = [];

  for (const conv of conversations.values()) {
    if (conv.participantIds.includes(auth.userId)) {
      result.push(conv);
    }
  }

  result.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  ctx.body = result;
});

// ─── Send encrypted message ─────────────────────────────────────────────────
dmsRouter.post("/conversations/:id/messages", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  const convId = ctx.params["id"]!;
  const conv = conversations.get(convId);

  if (!conv || !conv.participantIds.includes(auth.userId)) {
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

  const recipientId = conv.participantIds.find(id => id !== auth.userId)!;
  const now = new Date();

  const msg: DmMessage = {
    id: nanoid(),
    conversationId: convId,
    senderId: auth.userId,
    senderHandle: auth.handle,
    recipientId,
    encryptedContent,
    nonce,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString(),
  };

  const convMessages = messages.get(convId) ?? [];
  convMessages.push(msg);
  messages.set(convId, convMessages);

  conv.lastMessageAt = now.toISOString();
  conversations.set(convId, conv);

  ctx.status = 201;
  ctx.body = msg;
});

// ─── Get conversation messages ──────────────────────────────────────────────
dmsRouter.get("/conversations/:id/messages", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  const convId = ctx.params["id"]!;
  const conv = conversations.get(convId);

  if (!conv || !conv.participantIds.includes(auth.userId)) {
    ctx.status = 404;
    ctx.body = { error: "Conversation not found" };
    return;
  }

  const convMessages = messages.get(convId) ?? [];
  const now = Date.now();

  // Filter out expired messages (disappearing)
  const active = convMessages.filter(m => {
    if (new Date(m.expiresAt).getTime() <= now) return false;
    return true;
  });

  // Clean up expired
  messages.set(convId, active);

  // Mark messages as read for recipient
  active.forEach(m => {
    if (m.recipientId === auth.userId && !m.readAt) {
      m.readAt = new Date().toISOString();
    }
  });

  ctx.body = active;
});
