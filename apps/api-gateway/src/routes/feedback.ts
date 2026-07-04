import Router from "@koa/router";
import type { Context } from "koa";
import { nanoid } from "nanoid";
import db from "../db.js";

export const feedbackRouter = new Router({ prefix: "/feedback" });

const stmts = {
  insertChannel: db.prepare(
    `INSERT INTO feedback_channels (id, workspace_slug, name, slug, mode, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
  ),
  getChannel: db.prepare(`SELECT * FROM feedback_channels WHERE id = ?`),
  countMessages: db.prepare(`SELECT COUNT(*) as c FROM feedback_messages WHERE channel_id = ?`),
  insertMessage: db.prepare(
    `INSERT INTO feedback_messages (id, channel_id, ciphertext, sentiment_tag, topic_tag, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ),
};

feedbackRouter.post("/channels", async (ctx: Context) => {
  const body = ctx.request.body as Record<string, unknown>;
  const workspaceSlug = String(body.workspaceSlug ?? "");
  const name = String(body.name ?? "").trim();
  const mode = String(body.mode ?? "one_way") === "two_way" ? "two_way" : "one_way";

  if (!name) {
    ctx.status = 400;
    ctx.body = { error: "name_required" };
    return;
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const id = nanoid();
  stmts.insertChannel.run(id, workspaceSlug || null, name, slug, mode, new Date().toISOString());

  ctx.status = 201;
  ctx.body = { id, name, slug, mode, isActive: true };
});

feedbackRouter.get("/channels/:id", async (ctx: Context) => {
  const channel = stmts.getChannel.get(ctx.params["id"]!) as any;
  if (!channel) {
    ctx.status = 404;
    ctx.body = { error: "channel_not_found" };
    return;
  }

  const count = (stmts.countMessages.get(channel.id) as any).c;
  ctx.body = {
    id: channel.id,
    name: channel.name,
    slug: channel.slug,
    mode: channel.mode,
    isActive: !!channel.is_active,
    messageCount: count,
  };
});

feedbackRouter.post("/channels/:id/messages", async (ctx: Context) => {
  const channel = stmts.getChannel.get(ctx.params["id"]!) as any;
  if (!channel) {
    ctx.status = 404;
    ctx.body = { error: "channel_not_found" };
    return;
  }

  const body = ctx.request.body as Record<string, unknown>;
  const ciphertext = String(body.ciphertext ?? "");

  if (!ciphertext) {
    ctx.status = 400;
    ctx.body = { error: "ciphertext_required" };
    return;
  }

  const id = nanoid();
  const createdAt = new Date().toISOString();
  const sentimentTag = body.sentimentTag ? String(body.sentimentTag).slice(0, 40) : null;
  const topicTag = body.topicTag ? String(body.topicTag).slice(0, 40) : null;
  stmts.insertMessage.run(id, channel.id, ciphertext, sentimentTag, topicTag, createdAt);

  ctx.status = 201;
  ctx.body = { id, createdAt };
});
