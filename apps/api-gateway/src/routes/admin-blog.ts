import Router from "@koa/router";
import type { Context } from "koa";
import { nanoid } from "nanoid";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireSuperAdmin } from "../middleware/admin.js";
import { requireBlogEditor, requireBlogReader } from "../middleware/blog-editor.js";
import { blobStore } from "../lib/blob-store.js";
import { publicBlobUrl } from "../lib/public-url.js";
import { isValidBlogSlug, mapBlogPostRow, slugifyTitle } from "../lib/blog.js";

export const adminBlogRouter = new Router({ prefix: "/admin" });

adminBlogRouter.use(requireAuth());

function logAudit(
  actorId: string,
  actorHandle: string,
  action: string,
  targetType: string,
  targetId: string | null,
  details?: string,
) {
  db.prepare(
    `INSERT INTO audit_log (id, actor_id, actor_handle, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(nanoid(), actorId, actorHandle, action, targetType, targetId, details ?? null, new Date().toISOString());
}

function resolveUniqueSlug(baseSlug: string, excludeId?: string): string {
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const existing = excludeId
      ? (db.prepare("SELECT id FROM blog_posts WHERE slug = ? AND id != ?").get(slug, excludeId) as { id: string } | undefined)
      : (db.prepare("SELECT id FROM blog_posts WHERE slug = ?").get(slug) as { id: string } | undefined);
    if (!existing) return slug;
    slug = `${baseSlug.slice(0, 75)}-${suffix}`;
    suffix += 1;
  }
}

// ─── Blog posts list ─────────────────────────────────────────────────────────

adminBlogRouter.get("/blog-posts", requireBlogReader(), async (ctx: Context) => {
  const status = String(ctx.query.status ?? "draft");
  const limit = Math.min(Number(ctx.query.limit) || 50, 100);
  const offset = Number(ctx.query.offset) || 0;

  if (!["draft", "published", "archived"].includes(status)) {
    ctx.status = 400;
    ctx.body = { error: "invalid_status" };
    return;
  }

  const posts = db
    .prepare(
      `SELECT bp.*, u.handle as author_handle
       FROM blog_posts bp
       LEFT JOIN users u ON bp.author_id = u.id
       WHERE bp.status = ?
       ORDER BY bp.updated_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(status, limit, offset);

  const total = (db.prepare("SELECT count(*) as c FROM blog_posts WHERE status = ?").get(status) as { c: number }).c;

  ctx.body = {
    posts: (posts as Record<string, unknown>[]).map(mapBlogPostRow),
    total,
    limit,
    offset,
  };
});

adminBlogRouter.get("/blog-posts/:id", requireBlogReader(), async (ctx: Context) => {
  const row = db
    .prepare(
      `SELECT bp.*, u.handle as author_handle
       FROM blog_posts bp
       LEFT JOIN users u ON bp.author_id = u.id
       WHERE bp.id = ?`,
    )
    .get(ctx.params.id) as Record<string, unknown> | undefined;

  if (!row) {
    ctx.status = 404;
    ctx.body = { error: "not_found" };
    return;
  }

  ctx.body = mapBlogPostRow(row);
});

// ─── Create ──────────────────────────────────────────────────────────────────

adminBlogRouter.post("/blog-posts", requireBlogEditor(), async (ctx: Context) => {
  const body = (ctx.request.body ?? {}) as Record<string, unknown>;
  const user = ctx.state.user!;
  const title = String(body.title ?? "").trim();
  const excerpt = String(body.excerpt ?? "").trim();
  const postBody = String(body.body ?? "").trim();
  const keywords = body.keywords ? String(body.keywords).trim() : null;
  const coverImageUrl = body.coverImageUrl ? String(body.coverImageUrl).trim() : null;
  let slug = body.slug ? String(body.slug).trim().toLowerCase() : slugifyTitle(title);

  if (!title || !excerpt || !postBody) {
    ctx.status = 400;
    ctx.body = { error: "invalid_input", message: "title, excerpt, and body are required" };
    return;
  }

  if (!isValidBlogSlug(slug)) {
    ctx.status = 400;
    ctx.body = { error: "invalid_slug" };
    return;
  }

  slug = resolveUniqueSlug(slug);

  const now = new Date().toISOString();
  const id = nanoid();
  const status = body.status === "published" ? "published" : "draft";
  const publishedAt = status === "published" ? now : null;

  db.prepare(
    `INSERT INTO blog_posts (id, slug, title, excerpt, body, cover_image_url, keywords, status, author_id, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, slug, title, excerpt, postBody, coverImageUrl, keywords, status, user.userId, publishedAt, now, now);

  logAudit(user.userId, user.handle, status === "published" ? "blog_post_published" : "blog_post_created", "blog_post", id, title);

  const row = db
    .prepare(
      `SELECT bp.*, u.handle as author_handle FROM blog_posts bp LEFT JOIN users u ON bp.author_id = u.id WHERE bp.id = ?`,
    )
    .get(id) as Record<string, unknown>;

  ctx.status = 201;
  ctx.body = mapBlogPostRow(row);
});

// ─── Update ──────────────────────────────────────────────────────────────────

adminBlogRouter.patch("/blog-posts/:id", requireBlogEditor(), async (ctx: Context) => {
  const body = (ctx.request.body ?? {}) as Record<string, unknown>;
  const user = ctx.state.user!;
  const existing = db.prepare("SELECT * FROM blog_posts WHERE id = ?").get(ctx.params.id) as Record<string, unknown> | undefined;

  if (!existing) {
    ctx.status = 404;
    ctx.body = { error: "not_found" };
    return;
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.title !== undefined) {
    updates.push("title = ?");
    values.push(String(body.title).trim());
  }
  if (body.excerpt !== undefined) {
    updates.push("excerpt = ?");
    values.push(String(body.excerpt).trim());
  }
  if (body.body !== undefined) {
    updates.push("body = ?");
    values.push(String(body.body).trim());
  }
  if (body.keywords !== undefined) {
    updates.push("keywords = ?");
    values.push(body.keywords ? String(body.keywords).trim() : null);
  }
  if (body.coverImageUrl !== undefined) {
    updates.push("cover_image_url = ?");
    values.push(body.coverImageUrl ? String(body.coverImageUrl).trim() : null);
  }
  if (body.slug !== undefined) {
    const slug = String(body.slug).trim().toLowerCase();
    if (!isValidBlogSlug(slug)) {
      ctx.status = 400;
      ctx.body = { error: "invalid_slug" };
      return;
    }
    updates.push("slug = ?");
    values.push(resolveUniqueSlug(slug, ctx.params.id));
  }
  if (body.status !== undefined) {
    const status = String(body.status);
    if (!["draft", "published", "archived"].includes(status)) {
      ctx.status = 400;
      ctx.body = { error: "invalid_status" };
      return;
    }
    updates.push("status = ?");
    values.push(status);
    if (status === "published" && !existing.published_at) {
      updates.push("published_at = ?");
      values.push(new Date().toISOString());
    }
    if (status === "draft") {
      updates.push("published_at = ?");
      values.push(null);
    }
  }

  if (updates.length === 0) {
    ctx.status = 400;
    ctx.body = { error: "no_changes" };
    return;
  }

  const now = new Date().toISOString();
  updates.push("updated_at = ?");
  values.push(now);
  values.push(ctx.params.id);

  db.prepare(`UPDATE blog_posts SET ${updates.join(", ")} WHERE id = ?`).run(...values);

  const action =
    body.status === "published" ? "blog_post_published" : body.status === "archived" ? "blog_post_archived" : "blog_post_updated";
  logAudit(user.userId, user.handle, action, "blog_post", ctx.params.id, String(body.title ?? existing.title));

  const row = db
    .prepare(
      `SELECT bp.*, u.handle as author_handle FROM blog_posts bp LEFT JOIN users u ON bp.author_id = u.id WHERE bp.id = ?`,
    )
    .get(ctx.params.id) as Record<string, unknown>;

  ctx.body = mapBlogPostRow(row);
});

// ─── Delete (admin only) ─────────────────────────────────────────────────────

adminBlogRouter.delete("/blog-posts/:id", requireSuperAdmin(), async (ctx: Context) => {
  const user = ctx.state.user!;
  const existing = db.prepare("SELECT title FROM blog_posts WHERE id = ?").get(ctx.params.id) as { title: string } | undefined;

  if (!existing) {
    ctx.status = 404;
    ctx.body = { error: "not_found" };
    return;
  }

  db.prepare("DELETE FROM blog_posts WHERE id = ?").run(ctx.params.id);
  logAudit(user.userId, user.handle, "blog_post_deleted", "blog_post", ctx.params.id, existing.title);
  ctx.body = { ok: true };
});

// ─── Cover image upload ──────────────────────────────────────────────────────

adminBlogRouter.post("/blog/cover", requireBlogEditor(), async (ctx: Context) => {
  const MAX_SIZE = 5 * 1024 * 1024;
  const contentType = ctx.get("Content-Type") ?? "";

  if (!contentType.startsWith("image/")) {
    ctx.status = 400;
    ctx.body = { error: "invalid_content_type", message: "Cover must be an image" };
    return;
  }

  const chunks: Buffer[] = [];
  let totalSize = 0;

  await new Promise<void>((resolve, reject) => {
    ctx.req.on("data", (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > MAX_SIZE) {
        reject(new Error("File too large"));
        return;
      }
      chunks.push(chunk);
    });
    ctx.req.on("end", resolve);
    ctx.req.on("error", reject);
  });

  const ext = contentType.split("/")[1]?.replace(/[^a-z0-9+.-]/gi, "") || "bin";
  const blobPath = `blog_${nanoid()}.${ext}`;
  await blobStore.put(blobPath, Buffer.concat(chunks));

  const url = publicBlobUrl(blobPath, ctx);
  ctx.status = 201;
  ctx.body = { url, blobPath, sizeBytes: totalSize };
});
