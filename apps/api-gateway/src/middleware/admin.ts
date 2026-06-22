import type { Context, Next } from "koa";
import db from "../db.js";

/**
 * Middleware that checks if the authenticated user has admin or moderator role.
 * Must be used AFTER requireAuth().
 */
export function requireAdmin() {
  return async (ctx: Context, next: Next) => {
    const user = ctx.state.user;
    if (!user) {
      ctx.status = 401;
      ctx.body = { error: "unauthorized" };
      return;
    }

    const row = db.prepare("SELECT role FROM users WHERE id = ?").get(user.userId) as any;
    if (!row || (row.role !== "admin" && row.role !== "moderator")) {
      ctx.status = 403;
      ctx.body = { error: "forbidden", message: "Admin access required" };
      return;
    }

    ctx.state.role = row.role;
    await next();
  };
}

/**
 * Middleware that requires specifically the admin role (not moderator).
 */
export function requireSuperAdmin() {
  return async (ctx: Context, next: Next) => {
    const user = ctx.state.user;
    if (!user) {
      ctx.status = 401;
      ctx.body = { error: "unauthorized" };
      return;
    }

    const row = db.prepare("SELECT role FROM users WHERE id = ?").get(user.userId) as any;
    if (!row || row.role !== "admin") {
      ctx.status = 403;
      ctx.body = { error: "forbidden", message: "Super admin access required" };
      return;
    }

    ctx.state.role = row.role;
    await next();
  };
}
