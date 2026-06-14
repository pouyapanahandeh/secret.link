import Router from "@koa/router";
import type { Context } from "koa";
import { nanoid } from "nanoid";
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { signToken, requireAuth, type AuthPayload } from "../middleware/auth.js";
import db from "../db.js";

export const usersRouter = new Router({ prefix: "/users" });

// Challenges are ephemeral — fine to keep in-memory
const challenges = new Map<string, string>();

// ─── Config ─────────────────────────────────────────────────────────────────
const RP_NAME = "Secretlink.life";
const RP_ID = process.env["RP_ID"] ?? "localhost";
const RP_ORIGIN = process.env["RP_ORIGIN"] ?? "http://localhost:3000";
const SES_REGION = process.env["SES_REGION"] ?? "eu-north-1";
const SES_FROM = process.env["SES_FROM"] ?? "noreply@secretlink.life";
const ses = new SESClient({ region: SES_REGION });

// ─── DB helpers ─────────────────────────────────────────────────────────────
const stmts = {
  insertUser: db.prepare(`INSERT INTO users (id, handle, email, is_pro, created_at) VALUES (?, ?, ?, 0, ?)`),
  getUserByHandle: db.prepare(`SELECT * FROM users WHERE handle = ?`),
  getUserById: db.prepare(`SELECT * FROM users WHERE id = ?`),
  updateProfile: db.prepare(`UPDATE users SET bio = ?, avatar_url = ?, socials = ? WHERE id = ?`),
  updateMagicLink: db.prepare(`UPDATE users SET magic_link_token = ?, magic_link_expires_at = ? WHERE id = ?`),
  clearMagicLink: db.prepare(`UPDATE users SET magic_link_token = NULL, magic_link_expires_at = NULL WHERE id = ?`),
  getUserByMagicToken: db.prepare(`SELECT * FROM users WHERE magic_link_token = ? AND magic_link_expires_at > ?`),
  getUserByEmail: db.prepare(`SELECT * FROM users WHERE email = ?`),
  searchUsers: db.prepare(`SELECT id, handle, bio, avatar_url, is_pro FROM users WHERE handle LIKE ? LIMIT 20`),
  insertCredential: db.prepare(`INSERT INTO credentials (id, user_id, public_key, counter, transports) VALUES (?, ?, ?, ?, ?)`),
  getCredentials: db.prepare(`SELECT * FROM credentials WHERE user_id = ?`),
  updateCredentialCounter: db.prepare(`UPDATE credentials SET counter = ? WHERE id = ?`),
  insertFollow: db.prepare(`INSERT OR IGNORE INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)`),
  deleteFollow: db.prepare(`DELETE FROM follows WHERE follower_id = ? AND following_id = ?`),
  isFollowing: db.prepare(`SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?`),
  countFollowers: db.prepare(`SELECT COUNT(*) as count FROM follows WHERE following_id = ?`),
  countFollowing: db.prepare(`SELECT COUNT(*) as count FROM follows WHERE follower_id = ?`),
};

function dbUserToPublic(row: any) {
  return {
    id: row.id,
    handle: row.handle,
    email: row.email,
    isPro: !!row.is_pro,
    createdAt: row.created_at,
    bio: row.bio ?? null,
    avatarUrl: row.avatar_url ?? null,
    socials: row.socials ? JSON.parse(row.socials) : [],
  };
}

// ─── Signup ─────────────────────────────────────────────────────────────────
usersRouter.post("/", async (ctx: Context) => {
  const body = ctx.request.body as Record<string, unknown>;
  const handle = String(body.handle ?? "").trim().toLowerCase();
  const email = body.email ? String(body.email).trim() : undefined;

  if (!handle || handle.length < 3 || handle.length > 32) {
    ctx.status = 400;
    ctx.body = { error: "invalid_handle" };
    return;
  }

  if (!/^[a-z0-9_-]+$/.test(handle)) {
    ctx.status = 400;
    ctx.body = { error: "invalid_handle_format" };
    return;
  }

  if (stmts.getUserByHandle.get(handle)) {
    ctx.status = 409;
    ctx.body = { error: "handle_taken" };
    return;
  }

  const id = nanoid();
  const createdAt = new Date().toISOString();
  stmts.insertUser.run(id, handle, email ?? null, createdAt);

  const token = signToken({ userId: id, handle });

  ctx.cookies.set("sl_token", token, {
    httpOnly: true,
    secure: ctx.protocol === "https",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  ctx.status = 201;
  ctx.body = { user: { id, handle, email, isPro: false }, token };
});

// ─── Search users (must be before /:handle) ─────────────────────────────────
usersRouter.get("/search", async (ctx: Context) => {
  const q = String(ctx.query["q"] ?? "").trim().toLowerCase();
  if (!q || q.length < 2) {
    ctx.body = [];
    return;
  }

  const rows = stmts.searchUsers.all(`%${q}%`) as any[];
  ctx.body = rows.map(r => ({
    id: r.id,
    handle: r.handle,
    bio: r.bio ?? null,
    avatarUrl: r.avatar_url ?? null,
    isPro: !!r.is_pro,
  }));
});

// ─── Get user profile (public) ──────────────────────────────────────────────
usersRouter.get("/:handle", async (ctx: Context) => {
  const handle = ctx.params["handle"];
  if (handle === "me" || handle === "follow") return;
  const row = stmts.getUserByHandle.get(handle!) as any;

  if (!row) {
    ctx.status = 404;
    ctx.body = { error: "user_not_found" };
    return;
  }

  const followersCount = (stmts.countFollowers.get(row.id) as any)?.count ?? 0;
  const followingCount = (stmts.countFollowing.get(row.id) as any)?.count ?? 0;

  ctx.status = 200;
  ctx.body = {
    id: row.id,
    handle: row.handle,
    isPro: !!row.is_pro,
    createdAt: row.created_at,
    bio: row.bio ?? null,
    avatarUrl: row.avatar_url ?? null,
    socials: row.socials ? JSON.parse(row.socials) : [],
    followersCount,
    followingCount,
  };
});

// ─── Get current user (authenticated) ───────────────────────────────────────
usersRouter.get("/me/profile", requireAuth(), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const row = stmts.getUserById.get(userId) as any;

  if (!row) {
    ctx.status = 404;
    ctx.body = { error: "user_not_found" };
    return;
  }

  const creds = stmts.getCredentials.all(userId) as any[];

  ctx.status = 200;
  ctx.body = {
    ...dbUserToPublic(row),
    hasPasskey: creds.length > 0,
  };
});

// ─── Update profile ─────────────────────────────────────────────────────────
usersRouter.patch("/me/profile", requireAuth(), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const row = stmts.getUserById.get(userId) as any;
  if (!row) { ctx.status = 404; ctx.body = { error: "user_not_found" }; return; }

  const body = ctx.request.body as Record<string, unknown>;
  let bio = row.bio;
  let avatarUrl = row.avatar_url;
  let socials = row.socials;

  if (typeof body.bio === "string") bio = body.bio.slice(0, 300);
  if (typeof body.avatarUrl === "string") avatarUrl = body.avatarUrl.slice(0, 500);
  if (Array.isArray(body.socials)) {
    socials = JSON.stringify((body.socials as any[]).slice(0, 10).map((s) => ({
      platform: String(s.platform ?? "").slice(0, 30),
      url: String(s.url ?? "").slice(0, 200),
    })));
  }

  stmts.updateProfile.run(bio, avatarUrl, socials, userId);

  ctx.status = 200;
  ctx.body = { id: row.id, handle: row.handle, bio, avatarUrl, socials: JSON.parse(socials || "[]") };
});

// ─── Follow system ──────────────────────────────────────────────────────────
usersRouter.post("/follow/:targetId", requireAuth(), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const targetId = ctx.params["targetId"]!;

  if (targetId === userId) {
    ctx.status = 400;
    ctx.body = { error: "cannot_follow_self" };
    return;
  }

  if (!stmts.getUserById.get(targetId)) {
    ctx.status = 404;
    ctx.body = { error: "user_not_found" };
    return;
  }

  stmts.insertFollow.run(userId, targetId, new Date().toISOString());
  const followersCount = (stmts.countFollowers.get(targetId) as any)?.count ?? 0;
  ctx.body = { following: true, followersCount };
});

usersRouter.delete("/follow/:targetId", requireAuth(), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const targetId = ctx.params["targetId"]!;
  stmts.deleteFollow.run(userId, targetId);
  const followersCount = (stmts.countFollowers.get(targetId) as any)?.count ?? 0;
  ctx.body = { following: false, followersCount };
});

usersRouter.get("/follow/:targetId", requireAuth(), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const targetId = ctx.params["targetId"]!;
  const isFollowing = !!stmts.isFollowing.get(userId, targetId);
  const followersCount = (stmts.countFollowers.get(targetId) as any)?.count ?? 0;
  const followingCount = (stmts.countFollowing.get(targetId) as any)?.count ?? 0;
  ctx.body = { isFollowing, followersCount, followingCount };
});

// ─── WebAuthn: Start registration ───────────────────────────────────────────
usersRouter.post("/me/passkey/register-options", requireAuth(), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const row = stmts.getUserById.get(userId) as any;
  if (!row) { ctx.status = 404; ctx.body = { error: "user_not_found" }; return; }

  const creds = stmts.getCredentials.all(userId) as any[];

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: row.handle,
    userDisplayName: row.handle,
    attestationType: "none",
    excludeCredentials: creds.map((c) => ({
      id: c.id,
      transports: JSON.parse(c.transports || "[]"),
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  challenges.set(userId, options.challenge);
  ctx.body = options;
});

// ─── WebAuthn: Complete registration ────────────────────────────────────────
usersRouter.post("/me/passkey/register-verify", requireAuth(), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const row = stmts.getUserById.get(userId) as any;
  if (!row) { ctx.status = 404; ctx.body = { error: "user_not_found" }; return; }

  const expectedChallenge = challenges.get(userId);
  if (!expectedChallenge) { ctx.status = 400; ctx.body = { error: "no_challenge" }; return; }

  const body = ctx.request.body as any;

  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: RP_ORIGIN,
    expectedRPID: RP_ID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    ctx.status = 400;
    ctx.body = { error: "verification_failed" };
    return;
  }

  const { credential } = verification.registrationInfo;
  stmts.insertCredential.run(
    credential.id,
    userId,
    Buffer.from(credential.publicKey),
    credential.counter,
    JSON.stringify(body.response?.transports ?? []),
  );

  challenges.delete(userId);
  ctx.body = { verified: true };
});

// ─── WebAuthn: Start authentication ─────────────────────────────────────────
usersRouter.post("/auth/passkey/login-options", async (ctx: Context) => {
  const body = ctx.request.body as Record<string, unknown>;
  const handle = String(body.handle ?? "").trim().toLowerCase();
  const row = stmts.getUserByHandle.get(handle) as any;

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

  challenges.set(row.id, options.challenge);
  ctx.body = options;
});

// ─── WebAuthn: Verify authentication ────────────────────────────────────────
usersRouter.post("/auth/passkey/login-verify", async (ctx: Context) => {
  const body = ctx.request.body as Record<string, unknown>;
  const handle = String(body.handle ?? "").trim().toLowerCase();
  const row = stmts.getUserByHandle.get(handle) as any;

  if (!row) { ctx.status = 400; ctx.body = { error: "user_not_found" }; return; }

  const expectedChallenge = challenges.get(row.id);
  if (!expectedChallenge) { ctx.status = 400; ctx.body = { error: "no_challenge" }; return; }

  const creds = stmts.getCredentials.all(row.id) as any[];
  const credential = creds.find((c) => c.id === (body.credential as any)?.id);
  if (!credential) { ctx.status = 400; ctx.body = { error: "credential_not_found" }; return; }

  const verification = await verifyAuthenticationResponse({
    response: body.credential as any,
    expectedChallenge,
    expectedOrigin: RP_ORIGIN,
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

  stmts.updateCredentialCounter.run(verification.authenticationInfo.newCounter, credential.id);
  challenges.delete(row.id);

  const token = signToken({ userId: row.id, handle: row.handle });
  ctx.cookies.set("sl_token", token, {
    httpOnly: true,
    secure: ctx.protocol === "https",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  ctx.body = { token, user: { id: row.id, handle: row.handle } };
});

// ─── Magic Link: Request ────────────────────────────────────────────────────
usersRouter.post("/auth/magic-link", async (ctx: Context) => {
  const body = ctx.request.body as Record<string, unknown>;
  const email = String(body.email ?? "").trim().toLowerCase();

  const foundUser = stmts.getUserByEmail.get(email) as any;

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
        Subject: { Data: "Your login link — Secretlink.life" },
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
    console.error("[MAGIC LINK] SES send failed:", err);
    console.log(`[MAGIC LINK] Fallback link for @${foundUser.handle}: ${magicLink}`);
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

// ─── Logout ─────────────────────────────────────────────────────────────────
usersRouter.post("/auth/logout", async (ctx: Context) => {
  ctx.cookies.set("sl_token", "", { maxAge: 0 });
  ctx.body = { ok: true };
});
