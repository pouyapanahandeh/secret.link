import type { Context, Next } from "koa";

// In-memory sliding-window counters. Keeping this off SQLite avoids a write on
// every request to the single-threaded database. State is per-process; behind a
// single instance that is fine. If the API is ever scaled horizontally this
// should move to a shared store (e.g. Redis).

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 200;
const MAX_REQUESTS_AUTHED = 600;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Periodically drop expired buckets so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) {
    if (now > b.resetAt) buckets.delete(key);
  }
}, 60_000).unref?.();

function hit(key: string, windowMs: number): Bucket {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now > existing.resetAt) {
    const fresh = { count: 1, resetAt: now + windowMs };
    buckets.set(key, fresh);
    return fresh;
  }
  existing.count += 1;
  return existing;
}

// Requests originating on the same host (Remix SSR → API) never traverse the
// public proxy, so they arrive with a loopback address. These are trusted
// server-to-server calls and are not rate limited — but we still emit headers.
function isLoopback(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

export function rateLimiter() {
  return async (ctx: Context, next: Next) => {
    // ctx.ip honours X-Forwarded-For only when app.proxy === true (set in
    // index.ts). nginx is configured to overwrite XFF with the real client IP,
    // so external clients cannot spoof it.
    const ip = ctx.ip;
    const userId = ctx.state?.user?.userId as string | undefined;
    const key = userId ? `user:${userId}` : `ip:${ip}`;
    const limit = userId ? MAX_REQUESTS_AUTHED : MAX_REQUESTS;

    if (isLoopback(ip) && !userId) {
      // Trusted internal traffic: advertise headers but do not enforce.
      ctx.set("X-RateLimit-Limit", String(limit));
      ctx.set("X-RateLimit-Remaining", String(limit));
      ctx.set("X-RateLimit-Reset", String(Math.ceil((Date.now() + WINDOW_MS) / 1000)));
      await next();
      return;
    }

    const bucket = hit(key, WINDOW_MS);

    ctx.set("X-RateLimit-Limit", String(limit));
    ctx.set("X-RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
    ctx.set("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > limit) {
      ctx.status = 429;
      ctx.body = { error: "rate_limit_exceeded", retryAfter: Math.ceil((bucket.resetAt - Date.now()) / 1000) };
      return;
    }

    await next();
  };
}

// DM-specific rate limiter: 30 messages per minute per user.
const DM_WINDOW_MS = 60_000;
const DM_MAX_MESSAGES = 30;

export function dmRateLimiter() {
  return async (ctx: Context, next: Next) => {
    const userId = ctx.state?.user?.userId as string | undefined;
    if (!userId) { await next(); return; }

    const bucket = hit(`dm:${userId}`, DM_WINDOW_MS);
    if (bucket.count > DM_MAX_MESSAGES) {
      ctx.status = 429;
      ctx.body = { error: "message_rate_limit_exceeded", retryAfter: Math.ceil((bucket.resetAt - Date.now()) / 1000) };
      return;
    }

    await next();
  };
}

// Map post rate limiter: 10 posts per minute per IP.
const MAP_POST_WINDOW_MS = 60_000;
const MAP_POST_MAX = 10;

export function mapPostRateLimiter() {
  return async (ctx: Context, next: Next) => {
    const bucket = hit(`map-post:${ctx.ip}`, MAP_POST_WINDOW_MS);
    if (bucket.count > MAP_POST_MAX) {
      ctx.status = 429;
      ctx.body = { error: "map_post_rate_limit", retryAfter: Math.ceil((bucket.resetAt - Date.now()) / 1000) };
      return;
    }
    await next();
  };
}

// Blob upload rate limiter: 20 uploads per minute per IP.
const BLOB_UPLOAD_WINDOW_MS = 60_000;
const BLOB_UPLOAD_MAX = 20;

export function blobUploadRateLimiter() {
  return async (ctx: Context, next: Next) => {
    const bucket = hit(`blob-upload:${ctx.ip}`, BLOB_UPLOAD_WINDOW_MS);
    if (bucket.count > BLOB_UPLOAD_MAX) {
      ctx.status = 429;
      ctx.body = { error: "blob_upload_rate_limit", retryAfter: Math.ceil((bucket.resetAt - Date.now()) / 1000) };
      return;
    }
    await next();
  };
}

const RECOVERY_WINDOW_MS = 15 * 60_000;
const RECOVERY_MAX = 5;

/** Tight limit on recovery-code attempts (IP and handle). Does not skip loopback. */
export function recoveryCodeRateLimiter() {
  return async (ctx: Context, next: Next) => {
    const body = (ctx.request.body ?? {}) as { handle?: unknown };
    const handle = String(body.handle ?? "").trim().toLowerCase();
    const ipBucket = hit(`recovery-ip:${ctx.ip}`, RECOVERY_WINDOW_MS);
    if (ipBucket.count > RECOVERY_MAX) {
      ctx.status = 429;
      ctx.body = {
        error: "rate_limit_exceeded",
        retryAfter: Math.ceil((ipBucket.resetAt - Date.now()) / 1000),
      };
      return;
    }
    if (handle) {
      const handleBucket = hit(`recovery-handle:${handle}`, RECOVERY_WINDOW_MS);
      if (handleBucket.count > RECOVERY_MAX) {
        ctx.status = 429;
        ctx.body = {
          error: "rate_limit_exceeded",
          retryAfter: Math.ceil((handleBucket.resetAt - Date.now()) / 1000),
        };
        return;
      }
    }
    await next();
  };
}
