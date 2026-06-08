import type { Context, Next } from "koa";

const requests = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 100;

export function rateLimiter() {
  return async (ctx: Context, next: Next) => {
    const key = ctx.ip;
    const now = Date.now();

    let entry = requests.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + WINDOW_MS };
      requests.set(key, entry);
    }

    entry.count++;

    ctx.set("X-RateLimit-Limit", String(MAX_REQUESTS));
    ctx.set("X-RateLimit-Remaining", String(Math.max(0, MAX_REQUESTS - entry.count)));
    ctx.set("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > MAX_REQUESTS) {
      ctx.status = 429;
      ctx.body = { error: "rate_limit_exceeded" };
      return;
    }

    await next();
  };
}
