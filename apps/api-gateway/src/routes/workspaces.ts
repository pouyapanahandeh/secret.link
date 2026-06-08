import Router from "@koa/router";
import type { Context } from "koa";

export const workspacesRouter = new Router({ prefix: "/workspaces" });

// In-memory store for development
const workspaces = new Map<string, {
  id: string;
  name: string;
  slug: string;
  plan: string;
  region: string;
  seatCount: number;
  maxSeats: number;
  createdAt: string;
}>();

workspacesRouter.post("/", async (ctx: Context) => {
  const body = ctx.request.body as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  const slug = String(body.slug ?? "").trim().toLowerCase();
  const region = String(body.region ?? "us");

  if (!name || name.length < 2) {
    ctx.status = 400;
    ctx.body = { error: "invalid_name" };
    return;
  }

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    ctx.status = 400;
    ctx.body = { error: "invalid_slug" };
    return;
  }

  if (workspaces.has(slug)) {
    ctx.status = 409;
    ctx.body = { error: "slug_taken" };
    return;
  }

  if (!["us", "eu"].includes(region)) {
    ctx.status = 400;
    ctx.body = { error: "invalid_region" };
    return;
  }

  const workspace = {
    id: crypto.randomUUID(),
    name,
    slug,
    plan: "free",
    region,
    seatCount: 1,
    maxSeats: 15,
    createdAt: new Date().toISOString(),
  };

  workspaces.set(slug, workspace);
  ctx.status = 201;
  ctx.body = workspace;
});

workspacesRouter.get("/:slug", async (ctx: Context) => {
  const slug = ctx.params["slug"];
  const workspace = workspaces.get(slug!);

  if (!workspace) {
    ctx.status = 404;
    ctx.body = { error: "workspace_not_found" };
    return;
  }

  ctx.status = 200;
  ctx.body = workspace;
});
