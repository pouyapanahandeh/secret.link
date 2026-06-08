import Router from "@koa/router";
import type { Context } from "koa";

export const feedbackRouter = new Router({ prefix: "/feedback" });

// In-memory store for development
const channels = new Map<string, {
  id: string;
  workspaceSlug: string;
  name: string;
  slug: string;
  mode: "one_way" | "two_way";
  isActive: boolean;
  messages: Array<{
    id: string;
    ciphertext: string;
    sentimentTag?: string;
    topicTag?: string;
    createdAt: string;
  }>;
}>();

feedbackRouter.post("/channels", async (ctx: Context) => {
  const body = ctx.request.body as Record<string, unknown>;
  const workspaceSlug = String(body.workspaceSlug ?? "");
  const name = String(body.name ?? "").trim();
  const mode = String(body.mode ?? "one_way") as "one_way" | "two_way";

  if (!name) {
    ctx.status = 400;
    ctx.body = { error: "name_required" };
    return;
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const id = crypto.randomUUID();

  const channel = { id, workspaceSlug, name, slug, mode, isActive: true, messages: [] };
  channels.set(id, channel);

  ctx.status = 201;
  ctx.body = { id, name, slug, mode, isActive: true };
});

feedbackRouter.get("/channels/:id", async (ctx: Context) => {
  const channel = channels.get(ctx.params["id"]!);
  if (!channel) {
    ctx.status = 404;
    ctx.body = { error: "channel_not_found" };
    return;
  }

  ctx.body = {
    id: channel.id,
    name: channel.name,
    slug: channel.slug,
    mode: channel.mode,
    isActive: channel.isActive,
    messageCount: channel.messages.length,
  };
});

feedbackRouter.post("/channels/:id/messages", async (ctx: Context) => {
  const channel = channels.get(ctx.params["id"]!);
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

  const message = {
    id: crypto.randomUUID(),
    ciphertext,
    createdAt: new Date().toISOString(),
  };

  channel.messages.push(message);
  ctx.status = 201;
  ctx.body = { id: message.id, createdAt: message.createdAt };
});
