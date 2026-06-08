import Router from "@koa/router";
import type { Context } from "koa";

export const usersRouter = new Router({ prefix: "/users" });

// In-memory store for development
const users = new Map<string, {
  id: string;
  handle: string;
  email?: string;
  isPro: boolean;
  createdAt: string;
}>();

usersRouter.post("/", async (ctx: Context) => {
  const body = ctx.request.body as Record<string, unknown>;
  const handle = String(body.handle ?? "").trim().toLowerCase();
  const email = body.email ? String(body.email).trim() : undefined;

  if (!handle || handle.length < 3 || handle.length > 32) {
    ctx.status = 400;
    ctx.body = { error: "invalid_handle" };
    return;
  }

  if (!/^[a-z0-9_-]+$/.test(handle)) {
    ctx.status = 400;
    ctx.body = { error: "invalid_handle_format" };
    return;
  }

  if (users.has(handle)) {
    ctx.status = 409;
    ctx.body = { error: "handle_taken" };
    return;
  }

  const user = {
    id: crypto.randomUUID(),
    handle,
    email,
    isPro: false,
    createdAt: new Date().toISOString(),
  };

  users.set(handle, user);
  ctx.status = 201;
  ctx.body = user;
});

usersRouter.get("/:handle", async (ctx: Context) => {
  const handle = ctx.params["handle"];
  const user = users.get(handle!);

  if (!user) {
    ctx.status = 404;
    ctx.body = { error: "user_not_found" };
    return;
  }

  ctx.status = 200;
  ctx.body = { handle: user.handle, isPro: user.isPro, createdAt: user.createdAt };
});
