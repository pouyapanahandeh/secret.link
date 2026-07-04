import Router from "@koa/router";
import type { Context } from "koa";
import db from "../db.js";

export const workspacesRouter = new Router({ prefix: "/workspaces" });

const stmts = {
  getBySlug: db.prepare(`SELECT * FROM workspaces WHERE slug = ?`),
  insert: db.prepare(
    `INSERT INTO workspaces (id, name, slug, plan, region, seat_count, max_seats, created_at)
     VALUES (?, ?, ?, 'free', ?, 1, 15, ?)`,
  ),
};

function rowToResponse(row: any) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    region: row.region,
    seatCount: row.seat_count,
    maxSeats: row.max_seats,
    createdAt: row.created_at,
  };
}

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

  if (!["us", "eu"].includes(region)) {
    ctx.status = 400;
    ctx.body = { error: "invalid_region" };
    return;
  }

  if (stmts.getBySlug.get(slug)) {
    ctx.status = 409;
    ctx.body = { error: "slug_taken" };
    return;
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  stmts.insert.run(id, name, slug, region, createdAt);

  ctx.status = 201;
  ctx.body = rowToResponse(stmts.getBySlug.get(slug));
});

workspacesRouter.get("/:slug", async (ctx: Context) => {
  const row = stmts.getBySlug.get(ctx.params["slug"]!) as any;

  if (!row) {
    ctx.status = 404;
    ctx.body = { error: "workspace_not_found" };
    return;
  }

  ctx.status = 200;
  ctx.body = rowToResponse(row);
});
