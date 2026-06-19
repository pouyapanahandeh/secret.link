import type { Context, Next } from "koa";
import db from "../db.js";

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 100;
const MAX_REQUESTS_AUTHED = 200;

const stmts = {
  get: db.prepare(`SELECT count, reset_at FROM rate_limits WHERE key = ?`),
  upsert: db.prepare(`INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = count + 1, reset_at = CASE WHEN excluded.reset_at > rate_limits.reset_at THEN excluded.reset_at ELSE rate_limits.reset_at END`),
  reset: db.prepare(`UPDATE rate_limits SET count = 1, reset_at = ? WHERE key = ?`),
  cleanup: db.prepare(`DELETE FROM rate_limits WHERE reset_at < ?`),
};

// Periodically clean expired entries
setInterval(() => { stmts.cleanup.run(Date.now()); }, 60_000);

export function rateLimiter() {
  return async (ctx: Context, next: Next) => {
    const userId = ctx.state?.user?.userId;
    const key = userId ? `user:${userId}` : `ip:${ctx.ip}`;
    const limit = userId ? MAX_REQUESTS_AUTHED : MAX_REQUESTS;
    const now = Date.now();

    const row = stmts.get.get(key) as { count: number; reset_at: number } | undefined;

    let count: number;
    if (!row || now > row.reset_at) {
      stmts.reset.run(now + WINDOW_MS, key);
      if (!row) stmts.upsert.run(key, now + WINDOW_MS);
      count = 1;
    } else {
      stmts.upsert.run(key, now + WINDOW_MS);
      count = row.count + 1;
    }

    const resetAt = row && now <= row.reset_at ? row.reset_at : now + WINDOW_MS;
    ctx.set("X-RateLimit-Limit", String(limit));
    ctx.set("X-RateLimit-Remaining", String(Math.max(0, limit - count)));
    ctx.set("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

    if (count > limit) {
      ctx.status = 429;
      ctx.body = { error: "rate_limit_exceeded" };
      return;
    }

    await next();
  };
}

// DM-specific rate limiter: 30 messages per minute per user
const DM_WINDOW_MS = 60_000;
const DM_MAX_MESSAGES = 30;

export function dmRateLimiter() {
  return async (ctx: Context, next: Next) => {
    const userId = ctx.state?.user?.userId;
    if (!userId) { await next(); return; }

    const key = `dm:${userId}`;
    const now = Date.now();

    const row = stmts.get.get(key) as { count: number; reset_at: number } | undefined;

    let count: number;
    if (!row || now > row.reset_at) {
      stmts.reset.run(now + DM_WINDOW_MS, key);
      if (!row) stmts.upsert.run(key, now + DM_WINDOW_MS);
      count = 1;
    } else {
      stmts.upsert.run(key, now + DM_WINDOW_MS);
      count = row.count + 1;
    }

    if (count > DM_MAX_MESSAGES) {
      const resetAt = row && now <= row.reset_at ? row.reset_at : now + DM_WINDOW_MS;
      ctx.status = 429;
      ctx.body = { error: "message_rate_limit_exceeded", retryAfter: Math.ceil((resetAt - now) / 1000) };
      return;
    }

    await next();
  };
}
