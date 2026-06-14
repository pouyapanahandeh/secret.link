import type { Context, Next } from "koa";

const requests = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 100;
const MAX_REQUESTS_AUTHED = 200; // Authenticated users get higher limit

export function rateLimiter() {
  return async (ctx: Context, next: Next) => {
    // Use userId if authenticated, else IP
    const userId = ctx.state?.user?.userId;
    const key = userId ? `user:${userId}` : `ip:${ctx.ip}`;
    const limit = userId ? MAX_REQUESTS_AUTHED : MAX_REQUESTS;
    const now = Date.now();

    let entry = requests.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + WINDOW_MS };
      requests.set(key, entry);
    }

    entry.count++;

    ctx.set("X-RateLimit-Limit", String(limit));
    ctx.set("X-RateLimit-Remaining", String(Math.max(0, limit - entry.count)));
    ctx.set("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > limit) {
      ctx.status = 429;
      ctx.body = { error: "rate_limit_exceeded" };
      return;
    }

    await next();
  };
}

// DM-specific rate limiter: 30 messages per minute per user
const dmRequests = new Map<string, { count: number; resetAt: number }>();
const DM_WINDOW_MS = 60_000;
const DM_MAX_MESSAGES = 30;

export function dmRateLimiter() {
  return async (ctx: Context, next: Next) => {
    const userId = ctx.state?.user?.userId;
    if (!userId) { await next(); return; }

    const key = `dm:${userId}`;
    const now = Date.now();

    let entry = dmRequests.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + DM_WINDOW_MS };
      dmRequests.set(key, entry);
    }

    entry.count++;

    if (entry.count > DM_MAX_MESSAGES) {
      ctx.status = 429;
      ctx.body = { error: "message_rate_limit_exceeded", retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
      return;
    }

    await next();
  };
}
