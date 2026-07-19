import type { Context, Next } from "koa";
import db from "../db.js";

function loadRole(ctx: Context): string | null {
  const user = ctx.state.user;
  if (!user) return null;
  const row = db.prepare("SELECT role FROM users WHERE id = ?").get(user.userId) as { role?: string } | undefined;
  return row?.role ?? null;
}

/** Allows admin, editor, or moderator (read-only blog access). */
export function requireBlogReader() {
  return async (ctx: Context, next: Next) => {
    if (!ctx.state.user) {
      ctx.status = 401;
      ctx.body = { error: "unauthorized" };
      return;
    }
    const role = loadRole(ctx);
    if (!role || !["admin", "editor", "moderator"].includes(role)) {
      ctx.status = 403;
      ctx.body = { error: "forbidden", message: "Blog access required" };
      return;
    }
    ctx.state.role = role;
    await next();
  };
}

/** Allows admin or editor (create/edit/publish blog posts). */
export function requireBlogEditor() {
  return async (ctx: Context, next: Next) => {
    if (!ctx.state.user) {
      ctx.status = 401;
      ctx.body = { error: "unauthorized" };
      return;
    }
    const role = loadRole(ctx);
    if (!role || (role !== "admin" && role !== "editor")) {
      ctx.status = 403;
      ctx.body = { error: "forbidden", message: "Blog editor access required" };
      return;
    }
    ctx.state.role = role;
    await next();
  };
}
