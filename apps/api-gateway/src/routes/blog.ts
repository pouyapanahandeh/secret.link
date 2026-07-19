import Router from "@koa/router";
import type { Context } from "koa";
import db from "../db.js";
import { mapBlogPostPublic } from "../lib/blog.js";

export const blogRouter = new Router({ prefix: "/public" });

blogRouter.get("/blog", async (ctx: Context) => {
  const limit = Math.min(Number(ctx.query.limit) || 20, 50);
  const offset = Number(ctx.query.offset) || 0;

  const rows = db
    .prepare(
      `SELECT slug, title, excerpt, cover_image_url, keywords, published_at, updated_at
       FROM blog_posts
       WHERE status = 'published'
       ORDER BY published_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as Record<string, unknown>[];

  const total = (
    db.prepare("SELECT count(*) as c FROM blog_posts WHERE status = 'published'").get() as { c: number }
  ).c;

  ctx.body = {
    posts: rows.map((row) => mapBlogPostPublic(row)),
    total,
    limit,
    offset,
  };
});

blogRouter.get("/blog/sitemap-slugs", async (ctx: Context) => {
  const rows = db
    .prepare(
      `SELECT slug, updated_at FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC`,
    )
    .all() as { slug: string; updated_at: string }[];

  ctx.body = { slugs: rows.map((r) => ({ slug: r.slug, updatedAt: r.updated_at })) };
});

blogRouter.get("/blog/:slug", async (ctx: Context) => {
  const row = db
    .prepare(
      `SELECT slug, title, excerpt, body, cover_image_url, keywords, published_at, updated_at
       FROM blog_posts
       WHERE slug = ? AND status = 'published'`,
    )
    .get(ctx.params.slug) as Record<string, unknown> | undefined;

  if (!row) {
    ctx.status = 404;
    ctx.body = { error: "not_found" };
    return;
  }

  ctx.body = mapBlogPostPublic(row, true);
});
