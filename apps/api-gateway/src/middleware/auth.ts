import type { Context, Next } from "koa";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import db from "../db.js";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev-secret-change-in-production";

if (process.env["NODE_ENV"] === "production" && (!process.env["JWT_SECRET"] || process.env["JWT_SECRET"] === "dev-secret-change-in-production")) {
  throw new Error("JWT_SECRET must be set to a secure value in production");
}

export interface AuthPayload {
  userId: string;
  handle: string;
  jti?: string;
  scope?: "enroll_passkey";
}

/** Routes a recovery (enroll-only) JWT may call. Anything else is 403. */
const ENROLL_SCOPE_PATHS = new Set([
  "GET /v1/users/me/profile",
  "POST /v1/users/me/passkey/register-options",
  "POST /v1/users/me/passkey/register-verify",
]);

// ─── Token revocation (logout / forced sign-out) ────────────────────────────
const revokeStmts = {
  insert: db.prepare(`INSERT OR IGNORE INTO revoked_tokens (jti, user_id, revoked_at, expires_at) VALUES (?, ?, ?, ?)`),
  isRevoked: db.prepare(`SELECT 1 FROM revoked_tokens WHERE jti = ?`),
  cleanup: db.prepare(`DELETE FROM revoked_tokens WHERE expires_at < ?`),
};
setInterval(() => { revokeStmts.cleanup.run(Date.now()); }, 60 * 60_000).unref?.();

// ─── Suspension enforcement (with a short TTL cache) ────────────────────────
const suspensionStmt = db.prepare(
  `SELECT 1 FROM user_suspensions WHERE user_id = ? AND lifted_at IS NULL AND (expires_at IS NULL OR expires_at > ?) LIMIT 1`,
);
const suspensionCache = new Map<string, { suspended: boolean; checkedAt: number }>();
const SUSPENSION_TTL_MS = 30_000;

export function isUserSuspended(userId: string): boolean {
  const cached = suspensionCache.get(userId);
  const now = Date.now();
  if (cached && now - cached.checkedAt < SUSPENSION_TTL_MS) return cached.suspended;
  const suspended = !!suspensionStmt.get(userId, new Date().toISOString());
  suspensionCache.set(userId, { suspended, checkedAt: now });
  return suspended;
}

/** Invalidate the suspension cache for a user (call after suspend/unsuspend). */
export function clearSuspensionCache(userId: string): void {
  suspensionCache.delete(userId);
}

export function signToken(payload: Omit<AuthPayload, "jti">, expiresIn: string | number = "7d"): string {
  const jti = nanoid();
  return jwt.sign({ ...payload, jti }, JWT_SECRET, { expiresIn: expiresIn as jwt.SignOptions["expiresIn"] });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    if (decoded.jti && revokeStmts.isRevoked.get(decoded.jti)) return null;
    return decoded;
  } catch {
    return null;
  }
}

/** Revoke a token so it can no longer authenticate (used on logout). */
export function revokeToken(token: string): boolean {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload & { exp?: number };
    if (!decoded.jti) return false;
    const expiresAt = decoded.exp ? decoded.exp * 1000 : Date.now() + 7 * 24 * 60 * 60 * 1000;
    revokeStmts.insert.run(decoded.jti, decoded.userId ?? null, new Date().toISOString(), expiresAt);
    return true;
  } catch {
    return false;
  }
}

function extractToken(ctx: Context): string | null {
  const authHeader = ctx.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  return ctx.cookies.get("sl_token") ?? null;
}

/** Middleware that populates ctx.state.user if a valid token is present (does not reject). */
export function optionalAuth() {
  return async (ctx: Context, next: Next) => {
    const token = extractToken(ctx);
    if (token) {
      const payload = verifyToken(token);
      // A suspended user is treated as unauthenticated for optional-auth routes,
      // so they cannot exercise any authed capability while suspended.
      if (payload && !isUserSuspended(payload.userId)) {
        ctx.state.user = payload;
      }
    }
    await next();
  };
}

/** Middleware that requires a valid, non-revoked JWT and a non-suspended account. */
export function requireAuth() {
  return async (ctx: Context, next: Next) => {
    let payload = ctx.state.user as AuthPayload | undefined;

    if (!payload) {
      const token = extractToken(ctx);
      if (!token) {
        ctx.status = 401;
        ctx.body = { error: "unauthorized" };
        return;
      }
      const verified = verifyToken(token);
      if (!verified) {
        ctx.status = 401;
        ctx.body = { error: "invalid_token" };
        return;
      }
      payload = verified;
    }

    if (isUserSuspended(payload.userId)) {
      ctx.status = 403;
      ctx.body = { error: "account_suspended", message: "Your account is suspended." };
      return;
    }

    if (payload.scope === "enroll_passkey") {
      const allowed = ENROLL_SCOPE_PATHS.has(`${ctx.method} ${ctx.path}`);
      if (!allowed) {
        ctx.status = 403;
        ctx.body = { error: "insufficient_scope" };
        return;
      }
    }

    ctx.state.user = payload;
    touchLastSeen(payload.userId);
    await next();
  };
}

const LAST_SEEN_MS = 60 * 60 * 1000;
const lastSeenTouchedAt = new Map<string, number>();
const updateLastSeen = db.prepare(
  `UPDATE users SET last_seen_at = ? WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at < ?)`,
);

/** Record activity at most once per hour so last-seen filters stay cheap. */
function touchLastSeen(userId: string): void {
  const now = Date.now();
  const previous = lastSeenTouchedAt.get(userId) ?? 0;
  if (now - previous < LAST_SEEN_MS) return;
  lastSeenTouchedAt.set(userId, now);
  const iso = new Date(now).toISOString();
  const staleBefore = new Date(now - LAST_SEEN_MS).toISOString();
  try {
    updateLastSeen.run(iso, userId, staleBefore);
  } catch {
    // Column may be missing on a mid-migration process; never fail the request.
  }
}
