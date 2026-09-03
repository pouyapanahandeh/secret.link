import Router from "@koa/router";
import type { Context, Next } from "koa";
import {
  CreateChatInput,
  JoinChatInput,
  PostChatMessageInput,
} from "@secretlink/core/chat";
import type { AuthPayload } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import {
  chatCreateRateLimiter,
  chatJoinRateLimiter,
  chatMessageRateLimiter,
} from "../middleware/rate-limiter.js";
import { hashPin, pinDelay, verifyPin } from "../lib/pin.js";
import { signJoinToken, verifyJoinToken } from "../lib/chat-join-token.js";
import { chatsHub } from "../lib/chat-sse.js";
import * as chatRepo from "../repositories/chat-repo.js";

export const chatsRouter = new Router({ prefix: "/chats" });

function roomStatus(room: chatRepo.ChatRoomRow) {
  const expired = chatRepo.isExpired(room);
  return {
    id: room.id,
    hasPin: Boolean(room.pin_hash),
    pinLength: room.pin_hash ? room.pin_length ?? 4 : null,
    memberCount: room.member_count,
    maxMembers: room.max_members,
    expiresAt: room.expires_at,
    available: !expired && room.member_count < room.max_members,
  };
}

function notFound(ctx: Context) {
  ctx.status = 404;
  ctx.body = { error: "not_found" };
}

function gone(ctx: Context, kind: "expired" | "not_found" = "expired") {
  ctx.status = 410;
  ctx.body = { error: kind };
}

async function requireJoinToken(ctx: Context, next: Next) {
  const header = ctx.get("X-Chat-Token");
  const parsed = header ? verifyJoinToken(header) : null;
  if (!parsed || parsed.roomId !== ctx.params["id"]) {
    ctx.status = 401;
    ctx.body = { error: "unauthorized" };
    return;
  }
  const member = chatRepo.findMember(parsed.memberId, parsed.roomId);
  if (!member) {
    ctx.status = 401;
    ctx.body = { error: "unauthorized" };
    return;
  }
  ctx.state.chatJoin = parsed;
  await next();
}

chatsRouter.post("/", chatCreateRateLimiter(), validateBody(CreateChatInput), async (ctx: Context) => {
  const body = ctx.state.body as CreateChatInput;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + body.ttlSeconds * 1000);
  const pinHash = body.pin ? hashPin(body.pin) : null;
  const room = chatRepo.createRoom({
    pinHash,
    pinLength: body.pin ? body.pin.length : null,
    maxMembers: body.maxMembers,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  const sender = ctx.state.user as AuthPayload | undefined;
  let memberId: string | undefined;
  let token: string | undefined;

  if (body.displayName) {
    const wantAnonymous = body.anonymous === true || !sender;
    const joined = chatRepo.joinRoom({
      roomId: room.id,
      displayName: body.displayName,
      isAnonymous: wantAnonymous,
      userId: wantAnonymous ? null : sender!.userId,
    });
    if ("memberId" in joined) {
      memberId = joined.memberId;
      token = signJoinToken(room.id, joined.memberId, expiresAt.getTime());
    }
  }

  ctx.status = 201;
  ctx.body = {
    id: room.id,
    expiresAt: room.expires_at,
    ...(memberId && token ? { memberId, token } : {}),
  };
});

chatsRouter.get("/:id", async (ctx: Context) => {
  const id = String(ctx.params["id"] ?? "");
  const room = chatRepo.findRoom(id);
  if (!room) {
    notFound(ctx);
    return;
  }
  if (chatRepo.purgeIfExpired(room)) {
    gone(ctx);
    return;
  }
  ctx.body = roomStatus(room);
});

chatsRouter.post("/:id/join", chatJoinRateLimiter(), validateBody(JoinChatInput), async (ctx: Context) => {
  const id = String(ctx.params["id"] ?? "");
  const body = ctx.state.body as JoinChatInput;
  const room = chatRepo.findRoom(id);

  if (!room || chatRepo.isExpired(room)) {
    if (body.pin) await pinDelay();
    if (room) chatRepo.purgeIfExpired(room);
    notFound(ctx);
    return;
  }

  if (room.pin_hash) {
    await pinDelay();
    if (!body.pin || !verifyPin(body.pin, room.pin_hash)) {
      notFound(ctx);
      return;
    }
  }

  if (room.member_count >= room.max_members) {
    ctx.status = 409;
    ctx.body = { error: "room_full" };
    return;
  }

  const sender = ctx.state.user as AuthPayload | undefined;
  const wantAnonymous = body.anonymous === true || !sender;
  const joined = chatRepo.joinRoom({
    roomId: room.id,
    displayName: body.displayName,
    isAnonymous: wantAnonymous,
    userId: wantAnonymous ? null : sender!.userId,
  });

  if ("full" in joined) {
    ctx.status = 409;
    ctx.body = { error: "room_full" };
    return;
  }

  const expiresAtMs = new Date(room.expires_at).getTime();
  ctx.body = {
    memberId: joined.memberId,
    token: signJoinToken(room.id, joined.memberId, expiresAtMs),
    expiresAt: room.expires_at,
    displayName: body.displayName,
  };
});

chatsRouter.get("/:id/messages", requireJoinToken, async (ctx: Context) => {
  const id = String(ctx.params["id"] ?? "");
  const room = chatRepo.findRoom(id);
  if (!room) {
    notFound(ctx);
    return;
  }
  if (chatRepo.purgeIfExpired(room)) {
    gone(ctx);
    return;
  }
  ctx.body = {
    ...roomStatus(room),
    members: chatRepo.listMembers(id),
    messages: chatRepo.listMessages(id),
  };
});

chatsRouter.post(
  "/:id/messages",
  requireJoinToken,
  chatMessageRateLimiter(),
  validateBody(PostChatMessageInput),
  async (ctx: Context) => {
    const id = String(ctx.params["id"] ?? "");
    const join = ctx.state.chatJoin!;
    const room = chatRepo.findRoom(id);
    if (!room) {
      notFound(ctx);
      return;
    }
    if (chatRepo.purgeIfExpired(room)) {
      gone(ctx);
      return;
    }

    const body = ctx.state.body as PostChatMessageInput;
    const member = chatRepo.findMember(join.memberId, id);
    if (!member) {
      ctx.status = 401;
      ctx.body = { error: "unauthorized" };
      return;
    }

    const saved = chatRepo.insertMessage({
      roomId: id,
      memberId: join.memberId,
      ciphertext: body.ciphertext,
      nonce: body.nonce,
    });

    const payload = {
      id: saved.id,
      memberId: saved.member_id,
      displayName: member.display_name,
      ciphertext: saved.ciphertext,
      nonce: saved.nonce,
      createdAt: saved.created_at,
    };
    chatsHub.notify(id, "message", payload, join.memberId);
    ctx.status = 201;
    ctx.body = payload;
  },
);

chatsRouter.post("/:id/sse-ticket", requireJoinToken, async (ctx: Context) => {
  const id = String(ctx.params["id"] ?? "");
  const join = ctx.state.chatJoin!;
  const room = chatRepo.findRoom(id);
  if (!room) {
    notFound(ctx);
    return;
  }
  if (chatRepo.purgeIfExpired(room)) {
    gone(ctx);
    return;
  }
  const ticket = chatsHub.issueTicket(id, join.memberId);
  ctx.body = { ticket };
});

chatsRouter.get("/:id/sse", async (ctx: Context) => {
  const id = String(ctx.params["id"] ?? "");
  const ticket = typeof ctx.query["ticket"] === "string" ? ctx.query["ticket"] : undefined;
  if (!ticket) {
    ctx.status = 400;
    ctx.body = { error: "ticket_required" };
    return;
  }

  const resolved = chatsHub.consumeTicket(ticket);
  if (!resolved || resolved.channel !== id) {
    ctx.status = 401;
    ctx.body = { error: "invalid_or_expired_ticket" };
    return;
  }

  const room = chatRepo.findRoom(id);
  if (!room || chatRepo.purgeIfExpired(room)) {
    gone(ctx);
    return;
  }

  const member = chatRepo.findMember(resolved.userId, id);
  if (!member) {
    ctx.status = 401;
    ctx.body = { error: "unauthorized" };
    return;
  }

  await chatsHub.attach(ctx, id, resolved.userId);
});
