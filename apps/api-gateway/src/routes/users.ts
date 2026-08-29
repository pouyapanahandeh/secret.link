import Router from "@koa/router";
import type { Context } from "koa";
import { nanoid } from "nanoid";
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import {
  CreateUserInput,
  PatchProfileInput,
  PasskeyLoginOptionsInput,
  SearchUsersQuery,
  FollowTargetParams,
  PasskeyIdParams,
  RecoveryCodeLoginInput,
} from "@secretlink/core/user/schemas";
import { signToken, requireAuth, revokeToken, type AuthPayload } from "../middleware/auth.js";
import { validateBody, validateQuery, validateParams } from "../middleware/validate.js";
import { recoveryCodeRateLimiter } from "../middleware/rate-limiter.js";
import db from "../db.js";
import {
  mintRecoveryCodes,
  countUnusedRecoveryCodes,
  consumeRecoveryCode,
  stretchRecoveryCodeCheck,
} from "../lib/recovery-codes.js";
import { writeAuditLog } from "../lib/audit.js";
import { logger } from "../middleware/logger.js";
import { createNotification } from "../notifications.js";
import {
  recordProfileView,
  recordQrScan,
  recordSocialClick,
  getProfileStats,
} from "../lib/profile-stats.js";
import { RESERVED_HANDLES } from "../lib/blog.js";
import { userRepo, dbUserToPublic } from "../repositories/user-repo.js";
import { profileRepo } from "../repositories/profile-repo.js";
import { newestPublicKey, publicKeysForUser } from "../lib/dm-device-keys.js";

export const usersRouter = new Router({ prefix: "/users" });

// Challenge storage in SQLite (survives restarts)
const challengeStmts = {
  set: db.prepare(`INSERT INTO challenges (user_id, challenge, expires_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET challenge = excluded.challenge, expires_at = excluded.expires_at`),
  get: db.prepare(`SELECT challenge FROM challenges WHERE user_id = ? AND expires_at > ?`),
  del: db.prepare(`DELETE FROM challenges WHERE user_id = ?`),
  cleanup: db.prepare(`DELETE FROM challenges WHERE expires_at < ?`),
};
// Clean expired challenges periodically
setInterval(() => { challengeStmts.cleanup.run(Date.now()); }, 60_000);

// ─── Config ─────────────────────────────────────────────────────────────────
const RP_NAME = "Secretlink.life";
const RP_ID = process.env["RP_ID"] ?? "localhost";
const RP_ORIGIN = process.env["RP_ORIGIN"] ?? "http://localhost:3000,http://localhost:3002";
const RP_ORIGINS = [
  ...new Set([
    ...RP_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean),
    ...(RP_ID === "localhost" ? ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"] : []),
  ]),
];
const SES_REGION = process.env["SES_REGION"] ?? "eu-north-1";
const SES_FROM = process.env["SES_FROM"] ?? "noreply@secretlink.life";
const ses = new SESClient({ region: SES_REGION });

/** Best-effort owner notice. Never include a recovery code or token. Must not throw. */
async function notifyRecoveryByEmail(handle: string, email: string | null): Promise<void> {
  const to = email?.trim().toLowerCase();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return;
  const when = new Date().toISOString();
  try {
    await ses.send(new SendEmailCommand({
      Source: SES_FROM,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: "A recovery code was used on your Secretlink.life account" },
        Body: {
          Html: {
            Data: `
              <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
                <h2 style="margin: 0 0 16px;">Recovery code used</h2>
                <p style="color: #666; margin: 0 0 16px;">
                  A recovery code was used for <strong>@${handle}</strong> at ${when} (UTC).
                  That starts a passkey reset. If this was you, you can ignore this email.
                </p>
                <p style="color: #666; margin: 0 0 16px;">
                  If this was not you, contact support at
                  <a href="https://secretlink.life/contact">secretlink.life/contact</a>.
                </p>
              </div>
            `,
          },
        },
      },
    }));
  } catch (err) {
    logger.warn({ handle, err: err instanceof Error ? err.message : err }, "recovery notice email failed");
  }
}

// ─── DB helpers (auth-specific; user/profile/follow live in repositories) ───
const stmts = {
  updateMagicLink: db.prepare(`UPDATE users SET magic_link_token = ?, magic_link_expires_at = ? WHERE id = ?`),
  clearMagicLink: db.prepare(`UPDATE users SET magic_link_token = NULL, magic_link_expires_at = NULL WHERE id = ?`),
  getUserByMagicToken: db.prepare(`SELECT * FROM users WHERE magic_link_token = ? AND magic_link_expires_at > ?`),
  insertCredential: db.prepare(
    `INSERT INTO credentials (id, user_id, public_key, counter, transports, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ),
  getCredentials: db.prepare(`SELECT * FROM credentials WHERE user_id = ?`),
  listPasskeys: db.prepare(
    `SELECT id, created_at, last_used_at FROM credentials WHERE user_id = ? ORDER BY created_at ASC`,
  ),
  getCredentialById: db.prepare(`SELECT id, user_id FROM credentials WHERE id = ? AND user_id = ?`),
  deleteCredential: db.prepare(`DELETE FROM credentials WHERE id = ? AND user_id = ?`),
  deleteOtherCredentials: db.prepare(`DELETE FROM credentials WHERE user_id = ? AND id != ?`),
  countCredentials: db.prepare(`SELECT COUNT(*) AS c FROM credentials WHERE user_id = ?`),
  updateCredentialCounter: db.prepare(
    `UPDATE credentials SET counter = ?, last_used_at = ? WHERE id = ?`,
  ),
};

// ─── Signup ─────────────────────────────────────────────────────────────────
usersRouter.post("/", validateBody(CreateUserInput), async (ctx: Context) => {
  const body = ctx.state.body as { handle: string; email?: string };
  const handle = body.handle;
  const email = body.email;

  if (RESERVED_HANDLES.has(handle)) {
    ctx.status = 400;
    ctx.body = { error: "reserved_handle" };
    return;
  }

  if (userRepo.getUserByHandle.get(handle)) {
    ctx.status = 409;
    ctx.body = { error: "handle_taken" };
    return;
  }

  const id = nanoid();
  const createdAt = new Date().toISOString();
  userRepo.insertUser.run(id, handle, email ?? null, createdAt);

  const token = signToken({ userId: id, handle });

  ctx.cookies.set("sl_token", token, {
    httpOnly: true,
    secure: ctx.protocol === "https",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  // The token is delivered ONLY via the HttpOnly cookie, never in the JSON body,
  // so it is never exposed to page JavaScript. Server-side callers (Remix SSR)
  // read it from the Set-Cookie response header.
  ctx.status = 201;
  ctx.body = { user: { id, handle, email, isPro: false } };
});

// ─── Search users (must be before /:handle) ─────────────────────────────────
/** Public handles for sitemap generation (no PII beyond handle). */
usersRouter.get("/sitemap-handles", async (ctx: Context) => {
  const rows = userRepo.listSitemapHandles.all() as Array<{ handle: string }>;
  ctx.set("Cache-Control", "public, max-age=3600");
  ctx.body = { handles: rows.map((r) => r.handle) };
});

usersRouter.get("/search", validateQuery(SearchUsersQuery), async (ctx: Context) => {
  const { q } = ctx.state.query as { q: string };

  const rows = userRepo.searchUsers.all(`%${q}%`) as any[];

  // Resolve follow state for the requesting user in a single query (no N+1).
  const requester = ctx.state.user as AuthPayload | undefined;
  let followingSet = new Set<string>();
  if (requester) {
    const ids = profileRepo.followingIdsOf.all(requester.userId) as Array<{ following_id: string }>;
    followingSet = new Set(ids.map(r => r.following_id));
  }

  ctx.body = rows.map(r => ({
    id: r.id,
    handle: r.handle,
    bio: r.bio ?? null,
    avatarUrl: r.avatar_url ?? null,
    isPro: !!r.is_pro,
    isSelf: requester ? r.id === requester.userId : false,
    isFollowing: followingSet.has(r.id),
  }));
});

// ─── Get current user (short, for auth checks) ─────────────────────────────
usersRouter.get("/me", requireAuth(), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const row = userRepo.getUserById.get(userId) as any;
  if (!row) { ctx.status = 404; ctx.body = { error: "user_not_found" }; return; }
  ctx.body = dbUserToPublic(row);
});

// ─── Profile stats (owner only - aggregate counters, no visitor data) ────────
usersRouter.get("/me/stats", requireAuth(), async (ctx: Context) => {
  const { userId, handle } = ctx.state.user as AuthPayload;
  const days = Number(ctx.query["days"] ?? 30);
  ctx.body = getProfileStats(userId, handle, days);
});

// ─── Tracked social link redirect (public) ───────────────────────────────────
usersRouter.get("/link/:handle/:platform", async (ctx: Context) => {
  const handle = String(ctx.params["handle"] ?? "").toLowerCase();
  const platform = String(ctx.params["platform"] ?? "").toLowerCase();
  const row = userRepo.getUserByHandle.get(handle) as any;
  if (!row) {
    ctx.status = 404;
    ctx.body = { error: "user_not_found" };
    return;
  }

  const socials: Array<{ platform: string; url: string }> = row.socials
    ? JSON.parse(row.socials)
    : [];
  const link = socials.find((s) => s.platform.toLowerCase() === platform);
  if (!link?.url) {
    ctx.status = 404;
    ctx.body = { error: "link_not_found" };
    return;
  }

  let dest = link.url.trim();
  if (!/^https?:\/\//i.test(dest)) dest = `https://${dest}`;
  try {
    const parsed = new URL(dest);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      ctx.status = 400;
      ctx.body = { error: "invalid_url" };
      return;
    }
  } catch {
    ctx.status = 400;
    ctx.body = { error: "invalid_url" };
    return;
  }

  recordSocialClick(row.id);
  ctx.redirect(dest);
});

// ─── QR scan beacon (public, non-owner only) ───────────────────────────────
usersRouter.post("/track/qr/:handle", async (ctx: Context) => {
  const handle = String(ctx.params["handle"] ?? "").toLowerCase();
  const row = userRepo.getUserByHandle.get(handle) as any;
  if (!row) {
    ctx.status = 404;
    ctx.body = { error: "user_not_found" };
    return;
  }

  const requester = ctx.state.user as AuthPayload | undefined;
  if (requester?.userId === row.id) {
    ctx.status = 204;
    return;
  }

  recordQrScan(row.id);
  ctx.status = 204;
});

// ─── Get user profile (public) ──────────────────────────────────────────────
usersRouter.get("/:handle", async (ctx: Context) => {
  const handle = ctx.params["handle"];
  if (handle === "me" || handle === "follow" || handle === "link" || handle === "track") return;
  const row = userRepo.getUserByHandle.get(handle!) as any;

  if (!row) {
    ctx.status = 404;
    ctx.body = { error: "user_not_found" };
    return;
  }

  const followersCount = (profileRepo.countFollowers.get(row.id) as any)?.count ?? 0;
  const followingCount = (profileRepo.countFollowing.get(row.id) as any)?.count ?? 0;
  const dmPublicKeys = publicKeysForUser(row.id);
  const dmPublicKey = newestPublicKey(row.id);

  // Follower/following counts are private - only the profile owner sees them.
  const requester = ctx.state.user as AuthPayload | undefined;
  const isOwner = requester?.userId === row.id;

  // Aggregate profile view - skip owner self-views; no visitor identifiers stored.
  if (!isOwner) {
    recordProfileView(row.id);
  }

  ctx.status = 200;
  ctx.body = {
    id: row.id,
    handle: row.handle,
    isPro: !!row.is_pro,
    createdAt: row.created_at,
    bio: row.bio ?? null,
    avatarUrl: row.avatar_url ?? null,
    socials: row.socials ? JSON.parse(row.socials) : [],
    acceptsSecrets: row.accepts_secrets == null ? true : !!row.accepts_secrets,
    followersCount: isOwner ? followersCount : null,
    followingCount: isOwner ? followingCount : null,
    dmPublicKey,
    dmPublicKeys,
  };
});

// ─── Get current user (authenticated) ───────────────────────────────────────
usersRouter.get("/me/profile", requireAuth(), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const row = userRepo.getUserById.get(userId) as any;

  if (!row) {
    ctx.status = 404;
    ctx.body = { error: "user_not_found" };
    return;
  }

  const creds = stmts.getCredentials.all(userId) as any[];
  const followersCount = (profileRepo.countFollowers.get(userId) as any)?.count ?? 0;
  const followingCount = (profileRepo.countFollowing.get(userId) as any)?.count ?? 0;
  const payload = ctx.state.user as AuthPayload;

  ctx.status = 200;
  ctx.body = {
    ...dbUserToPublic(row),
    hasPasskey: creds.length > 0,
    passkeyCount: creds.length,
    hasRecoveryCodes: countUnusedRecoveryCodes(userId) > 0,
    enrollmentRequired: payload.scope === "enroll_passkey",
    followersCount,
    followingCount,
  };
});

// ─── Followers / Following lists (own account only) ─────────────────────────
// Resolve which of the listed users the requester already follows, so the UI
// can render a correct Follow/Following state without an N+1 round-trip.
function withFollowState(rows: any[], requesterId: string) {
  const followingSet = new Set(
    (profileRepo.followingIdsOf.all(requesterId) as Array<{ following_id: string }>).map((r) => r.following_id),
  );
  return rows.map((r) => ({
    id: r.id,
    handle: r.handle,
    bio: r.bio ?? null,
    avatarUrl: r.avatar_url ?? null,
    isPro: !!r.is_pro,
    isSelf: r.id === requesterId,
    isFollowing: followingSet.has(r.id),
  }));
}

usersRouter.get("/me/followers", requireAuth(), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const rows = profileRepo.listFollowers.all(userId) as any[];
  ctx.body = withFollowState(rows, userId);
});

usersRouter.get("/me/following", requireAuth(), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const rows = profileRepo.listFollowing.all(userId) as any[];
  ctx.body = withFollowState(rows, userId);
});

// ─── Update profile ─────────────────────────────────────────────────────────
usersRouter.patch("/me/profile", requireAuth(), validateBody(PatchProfileInput), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const row = userRepo.getUserById.get(userId) as any;
  if (!row) { ctx.status = 404; ctx.body = { error: "user_not_found" }; return; }

  const body = ctx.state.body as Record<string, unknown>;
  let bio = row.bio;
  let avatarUrl = row.avatar_url;
  let socials = row.socials;
  let acceptsSecrets = row.accepts_secrets == null ? 1 : row.accepts_secrets ? 1 : 0;

  if (typeof body.bio === "string") bio = body.bio;
  if (body.avatarUrl === null) avatarUrl = null;
  else if (typeof body.avatarUrl === "string") avatarUrl = body.avatarUrl || null;
  if (Array.isArray(body.socials)) {
    socials = JSON.stringify(body.socials);
  }
  if (typeof body.acceptsSecrets === "boolean") acceptsSecrets = body.acceptsSecrets ? 1 : 0;

  profileRepo.updateProfile.run(bio, avatarUrl, socials, acceptsSecrets, userId);

  ctx.status = 200;
  ctx.body = {
    id: row.id,
    handle: row.handle,
    bio,
    avatarUrl,
    socials: JSON.parse(socials || "[]"),
    acceptsSecrets: !!acceptsSecrets,
  };
});

// ─── Follow system ──────────────────────────────────────────────────────────
usersRouter.post("/follow/:targetId", requireAuth(), validateParams(FollowTargetParams), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const { targetId } = ctx.state.params as { targetId: string };

  if (targetId === userId) {
    ctx.status = 400;
    ctx.body = { error: "cannot_follow_self" };
    return;
  }

  if (!userRepo.getUserById.get(targetId)) {
    ctx.status = 404;
    ctx.body = { error: "user_not_found" };
    return;
  }

  profileRepo.insertFollow.run(userId, targetId, new Date().toISOString());
  const followersCount = (profileRepo.countFollowers.get(targetId) as any)?.count ?? 0;

  // Notify the followed user
  const { handle } = ctx.state.user as AuthPayload;
  createNotification({
    userId: targetId,
    type: "follow",
    actorId: userId,
    actorHandle: handle,
    entityId: userId,
  });

  ctx.body = { following: true, followersCount };
});

usersRouter.delete("/follow/:targetId", requireAuth(), validateParams(FollowTargetParams), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const { targetId } = ctx.state.params as { targetId: string };
  profileRepo.deleteFollow.run(userId, targetId);
  const followersCount = (profileRepo.countFollowers.get(targetId) as any)?.count ?? 0;
  ctx.body = { following: false, followersCount };
});

usersRouter.get("/follow/:targetId", requireAuth(), validateParams(FollowTargetParams), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const { targetId } = ctx.state.params as { targetId: string };
  const isFollowing = !!profileRepo.isFollowing.get(userId, targetId);
  const followersCount = (profileRepo.countFollowers.get(targetId) as any)?.count ?? 0;
  const followingCount = (profileRepo.countFollowing.get(targetId) as any)?.count ?? 0;
  ctx.body = { isFollowing, followersCount, followingCount };
});

// ─── Passkeys: list ─────────────────────────────────────────────────────────
usersRouter.get("/me/passkeys", requireAuth(), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const rows = stmts.listPasskeys.all(userId) as Array<{
    id: string;
    created_at: string | null;
    last_used_at: string | null;
  }>;
  ctx.body = {
    passkeys: rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
    })),
  };
});

// ─── Passkeys: delete one ───────────────────────────────────────────────────
usersRouter.delete("/me/passkeys/:id", requireAuth(), validateParams(PasskeyIdParams), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const { id } = ctx.state.params as { id: string };
  const row = stmts.getCredentialById.get(id, userId) as { id: string } | undefined;
  if (!row) {
    ctx.status = 404;
    ctx.body = { error: "credential_not_found" };
    return;
  }

  const count = (stmts.countCredentials.get(userId) as { c: number } | undefined)?.c ?? 0;
  if (count <= 1 && countUnusedRecoveryCodes(userId) === 0) {
    ctx.status = 400;
    ctx.body = { error: "last_passkey" };
    return;
  }

  stmts.deleteCredential.run(id, userId);
  ctx.body = { ok: true };
});

// ─── Recovery codes: rotate ─────────────────────────────────────────────────
usersRouter.post("/me/recovery-codes/rotate", requireAuth(), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const recoveryCodes = mintRecoveryCodes(userId);
  ctx.body = { recoveryCodes };
});

// ─── WebAuthn: Start registration ───────────────────────────────────────────
usersRouter.post("/me/passkey/register-options", requireAuth(), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const row = userRepo.getUserById.get(userId) as any;
  if (!row) { ctx.status = 404; ctx.body = { error: "user_not_found" }; return; }

  const payload = ctx.state.user as AuthPayload;
  const creds = stmts.getCredentials.all(userId) as any[];
  // Recovery replaces lost authenticators — excluding the old credential blocks
  // the same browser/device from enrolling a replacement.
  const excludeCredentials =
    payload.scope === "enroll_passkey"
      ? []
      : creds.map((c) => ({
          id: c.id,
          transports: JSON.parse(c.transports || "[]"),
        }));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: row.handle,
    userDisplayName: row.handle,
    attestationType: "none",
    excludeCredentials,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  challengeStmts.set.run(userId, options.challenge, Date.now() + 5 * 60_000);
  ctx.body = options;
});

// ─── WebAuthn: Complete registration ────────────────────────────────────────
usersRouter.post("/me/passkey/register-verify", requireAuth(), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const row = userRepo.getUserById.get(userId) as any;
  if (!row) { ctx.status = 404; ctx.body = { error: "user_not_found" }; return; }

  const challengeRow = challengeStmts.get.get(userId, Date.now()) as any;
  if (!challengeRow) { ctx.status = 400; ctx.body = { error: "no_challenge" }; return; }
  const expectedChallenge = challengeRow.challenge;

  const body = ctx.request.body as any;

  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: RP_ORIGINS,
    expectedRPID: RP_ID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    ctx.status = 400;
    ctx.body = { error: "verification_failed" };
    return;
  }

  const existingCount = (stmts.countCredentials.get(userId) as { c: number } | undefined)?.c ?? 0;
  const { credential } = verification.registrationInfo;
  const createdAt = new Date().toISOString();
  stmts.insertCredential.run(
    credential.id,
    userId,
    Buffer.from(credential.publicKey),
    credential.counter,
    JSON.stringify(body.response?.transports ?? []),
    createdAt,
  );

  challengeStmts.del.run(userId);

  const payload = ctx.state.user as AuthPayload;
  if (payload.scope === "enroll_passkey") {
    stmts.deleteOtherCredentials.run(userId, credential.id);
    const authHeader = ctx.get("Authorization");
    const presented = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : ctx.cookies.get("sl_token");
    if (presented) revokeToken(presented);
    const recoveryCodes = mintRecoveryCodes(userId);
    const token = signToken({ userId, handle: row.handle });
    ctx.cookies.set("sl_token", token, {
      httpOnly: true,
      secure: ctx.protocol === "https",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    writeAuditLog({
      actorId: userId,
      actorHandle: row.handle,
      action: "passkey_replaced_via_recovery",
      targetType: "user",
      targetId: userId,
      details: JSON.stringify({ ip: ctx.ip }),
    });
    ctx.body = { verified: true, token, recoveryCodes };
    return;
  }

  if (existingCount === 0 && countUnusedRecoveryCodes(userId) === 0) {
    ctx.body = { verified: true, recoveryCodes: mintRecoveryCodes(userId) };
    return;
  }

  ctx.body = { verified: true };
});

// ─── WebAuthn: Start authentication ─────────────────────────────────────────
usersRouter.post("/auth/passkey/login-options", validateBody(PasskeyLoginOptionsInput), async (ctx: Context) => {
  const { handle } = ctx.state.body as { handle: string };
  const row = userRepo.getUserByHandle.get(handle) as any;

  if (!row) { ctx.status = 400; ctx.body = { error: "no_passkey" }; return; }

  const creds = stmts.getCredentials.all(row.id) as any[];
  if (creds.length === 0) { ctx.status = 400; ctx.body = { error: "no_passkey" }; return; }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: creds.map((c) => ({
      id: c.id,
      transports: JSON.parse(c.transports || "[]"),
    })),
    userVerification: "preferred",
  });

  challengeStmts.set.run(row.id, options.challenge, Date.now() + 5 * 60_000);
  ctx.body = options;
});

// ─── WebAuthn: Verify authentication ────────────────────────────────────────
usersRouter.post("/auth/passkey/login-verify", async (ctx: Context) => {
  const body = ctx.request.body as Record<string, unknown>;
  const handle = String(body.handle ?? "").trim().toLowerCase();
  const row = userRepo.getUserByHandle.get(handle) as any;

  if (!row) { ctx.status = 400; ctx.body = { error: "user_not_found" }; return; }

  const challengeRow = challengeStmts.get.get(row.id, Date.now()) as any;
  if (!challengeRow) { ctx.status = 400; ctx.body = { error: "no_challenge" }; return; }
  const expectedChallenge = challengeRow.challenge;

  const creds = stmts.getCredentials.all(row.id) as any[];
  const credential = creds.find((c) => c.id === (body.credential as any)?.id);
  if (!credential) { ctx.status = 400; ctx.body = { error: "credential_not_found" }; return; }

  const verification = await verifyAuthenticationResponse({
    response: body.credential as any,
    expectedChallenge,
    expectedOrigin: RP_ORIGINS,
    expectedRPID: RP_ID,
    credential: {
      id: credential.id,
      publicKey: credential.public_key,
      counter: credential.counter,
      transports: JSON.parse(credential.transports || "[]"),
    },
  });

  if (!verification.verified) {
    ctx.status = 401;
    ctx.body = { error: "auth_failed" };
    return;
  }

  stmts.updateCredentialCounter.run(
    verification.authenticationInfo.newCounter,
    new Date().toISOString(),
    credential.id,
  );
  challengeStmts.del.run(row.id);

  const token = signToken({ userId: row.id, handle: row.handle });
  ctx.cookies.set("sl_token", token, {
    httpOnly: true,
    secure: ctx.protocol === "https",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  ctx.body = { token, user: { id: row.id, handle: row.handle } };
});

// ─── Recovery code: scoped enroll session ───────────────────────────────────
usersRouter.post(
  "/auth/recovery-code",
  recoveryCodeRateLimiter(),
  validateBody(RecoveryCodeLoginInput),
  async (ctx: Context) => {
    const { handle, code } = ctx.state.body as { handle: string; code: string };
    const invalid = () => {
      ctx.status = 401;
      ctx.body = { error: "invalid_recovery" };
    };

    const foundUser = userRepo.getUserByHandle.get(handle) as
      | { id: string; handle: string; email?: string | null }
      | undefined;
    if (!foundUser) {
      stretchRecoveryCodeCheck(code);
      invalid();
      return;
    }

    if (!consumeRecoveryCode(foundUser.id, code)) {
      invalid();
      return;
    }

    writeAuditLog({
      actorId: foundUser.id,
      actorHandle: foundUser.handle,
      action: "recovery_code_used",
      targetType: "user",
      targetId: foundUser.id,
      details: JSON.stringify({ ip: ctx.ip }),
    });
    void notifyRecoveryByEmail(foundUser.handle, foundUser.email ?? null);

    const token = signToken(
      { userId: foundUser.id, handle: foundUser.handle, scope: "enroll_passkey" },
      "15m",
    );
    ctx.cookies.set("sl_token", token, {
      httpOnly: true,
      secure: ctx.protocol === "https",
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
    });
    ctx.body = { token, user: { id: foundUser.id, handle: foundUser.handle } };
  },
);

// ─── Magic Link: Request ────────────────────────────────────────────────────
usersRouter.post("/auth/magic-link", async (ctx: Context) => {
  const body = ctx.request.body as Record<string, unknown>;
  const email = String(body.email ?? "").trim().toLowerCase();

  const foundUser = userRepo.getUserByEmail.get(email) as any;

  if (!foundUser) {
    ctx.body = { sent: true };
    return;
  }

  const magicToken = nanoid(32);
  stmts.updateMagicLink.run(magicToken, Date.now() + 10 * 60 * 1000, foundUser.id);

  const magicLink = `${RP_ORIGIN}/auth/verify?token=${magicToken}`;

  try {
    await ses.send(new SendEmailCommand({
      Source: SES_FROM,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: "Your login link - Secretlink.life" },
        Body: {
          Html: {
            Data: `
              <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
                <h2 style="margin: 0 0 16px;">Sign in to Secretlink.life</h2>
                <p style="color: #666; margin: 0 0 24px;">Click the button below to log in as <strong>@${foundUser.handle}</strong>. This link expires in 10 minutes.</p>
                <a href="${magicLink}" style="display: inline-block; background: #FFFC00; color: #000; font-weight: bold; padding: 12px 32px; border-radius: 999px; text-decoration: none;">Sign in →</a>
                <p style="color: #999; font-size: 12px; margin-top: 32px;">If you didn't request this, just ignore this email.</p>
              </div>
            `,
          },
        },
      },
    }));
  } catch (err) {
    // Never log the magic link itself (it is a bearer credential). Log only that
    // delivery failed, and surface a non-enumerating error to the caller.
    console.error("[MAGIC LINK] SES send failed:", err instanceof Error ? err.message : err);
    ctx.status = 502;
    ctx.body = { error: "email_delivery_failed", message: "Could not send the login email. Please try again shortly." };
    return;
  }

  ctx.body = { sent: true };
});

// ─── Magic Link: Verify ─────────────────────────────────────────────────────
usersRouter.post("/auth/magic-link/verify", async (ctx: Context) => {
  const body = ctx.request.body as Record<string, unknown>;
  const magicToken = String(body.token ?? "");

  const foundUser = stmts.getUserByMagicToken.get(magicToken, Date.now()) as any;

  if (!foundUser) {
    ctx.status = 401;
    ctx.body = { error: "invalid_or_expired_link" };
    return;
  }

  stmts.clearMagicLink.run(foundUser.id);

  const token = signToken({ userId: foundUser.id, handle: foundUser.handle });
  ctx.cookies.set("sl_token", token, {
    httpOnly: true,
    secure: ctx.protocol === "https",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  ctx.body = { token, user: { id: foundUser.id, handle: foundUser.handle } };
});

// ─── Short-lived token for client-side E2E DM calls ─────────────────────────
// The browser needs a bearer token to make client-side encrypted DM requests.
// Instead of handing out the 7-day session JWT, mint a fresh 15-minute token so
// a leak (e.g. via XSS) has a tightly bounded blast radius.
usersRouter.post("/auth/session-token", requireAuth(), async (ctx: Context) => {
  const { userId, handle } = ctx.state.user as AuthPayload;
  const token = signToken({ userId, handle }, "15m");
  ctx.body = { token, expiresIn: 900 };
});

// ─── Logout ─────────────────────────────────────────────────────────────────
usersRouter.post("/auth/logout", async (ctx: Context) => {
  // Revoke the presented token so it can't be reused even if it was captured.
  const authHeader = ctx.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : ctx.cookies.get("sl_token");
  if (token) revokeToken(token);
  ctx.cookies.set("sl_token", "", { maxAge: 0 });
  ctx.body = { ok: true };
});
