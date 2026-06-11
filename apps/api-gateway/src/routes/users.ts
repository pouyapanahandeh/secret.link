import Router from "@koa/router";
import type { Context } from "koa";
import { nanoid } from "nanoid";
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { signToken, requireAuth, type AuthPayload } from "../middleware/auth.js";

export const usersRouter = new Router({ prefix: "/users" });

// ─── In-memory stores ───────────────────────────────────────────────────────
interface StoredUser {
  id: string;
  handle: string;
  email?: string;
  isPro: boolean;
  createdAt: string;
  bio?: string;
  avatarUrl?: string;
  socials?: { platform: string; url: string }[];
  credentials: StoredCredential[];
  magicLinkToken?: string;
  magicLinkExpiresAt?: number;
}

interface StoredCredential {
  id: string;
  publicKey: Uint8Array;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
}

const users = new Map<string, StoredUser>();
const usersById = new Map<string, StoredUser>();
const challenges = new Map<string, string>();

// ─── Config ─────────────────────────────────────────────────────────────────
const RP_NAME = "Secretlink.life";
const RP_ID = process.env["RP_ID"] ?? "localhost";
const RP_ORIGIN = process.env["RP_ORIGIN"] ?? "http://localhost:3000";
const SES_REGION = process.env["SES_REGION"] ?? "eu-north-1";
const SES_FROM = process.env["SES_FROM"] ?? "noreply@secretlink.life";
const ses = new SESClient({ region: SES_REGION });

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

  if (users.has(handle)) {
    ctx.status = 409;
    ctx.body = { error: "handle_taken" };
    return;
  }

  const user: StoredUser = {
    id: nanoid(),
    handle,
    email,
    isPro: false,
    createdAt: new Date().toISOString(),
    credentials: [],
  };

  users.set(handle, user);
  usersById.set(user.id, user);

  const token = signToken({ userId: user.id, handle: user.handle });

  ctx.cookies.set("sl_token", token, {
    httpOnly: true,
    secure: ctx.protocol === "https",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  ctx.status = 201;
  ctx.body = { user: { id: user.id, handle: user.handle, email: user.email, isPro: user.isPro }, token };
});

// ─── Get user profile (public) ──────────────────────────────────────────────
usersRouter.get("/:handle", async (ctx: Context) => {
  const handle = ctx.params["handle"];
  if (handle === "me") return; // skip, handled below
  const user = users.get(handle!);

  if (!user) {
    ctx.status = 404;
    ctx.body = { error: "user_not_found" };
    return;
  }

  ctx.status = 200;
  ctx.body = {
    id: user.id,
    handle: user.handle,
    isPro: user.isPro,
    createdAt: user.createdAt,
    bio: user.bio ?? null,
    avatarUrl: user.avatarUrl ?? null,
    socials: user.socials ?? [],
    followersCount: followers.get(user.id)?.size ?? 0,
    followingCount: follows.get(user.id)?.size ?? 0,
  };
});

// ─── Get current user (authenticated) ───────────────────────────────────────
usersRouter.get("/me/profile", requireAuth(), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const user = usersById.get(userId);

  if (!user) {
    ctx.status = 404;
    ctx.body = { error: "user_not_found" };
    return;
  }

  ctx.status = 200;
  ctx.body = {
    id: user.id,
    handle: user.handle,
    email: user.email,
    isPro: user.isPro,
    createdAt: user.createdAt,
    hasPasskey: user.credentials.length > 0,
    bio: user.bio ?? null,
    avatarUrl: user.avatarUrl ?? null,
    socials: user.socials ?? [],
  };
});

// ─── Update profile ─────────────────────────────────────────────────────────
usersRouter.patch("/me/profile", requireAuth(), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const user = usersById.get(userId);
  if (!user) { ctx.status = 404; ctx.body = { error: "user_not_found" }; return; }

  const body = ctx.request.body as Record<string, unknown>;

  if (typeof body.bio === "string") {
    user.bio = body.bio.slice(0, 300);
  }
  if (typeof body.avatarUrl === "string") {
    user.avatarUrl = body.avatarUrl.slice(0, 500);
  }
  if (Array.isArray(body.socials)) {
    user.socials = (body.socials as any[]).slice(0, 10).map((s) => ({
      platform: String(s.platform ?? "").slice(0, 30),
      url: String(s.url ?? "").slice(0, 200),
    }));
  }

  ctx.status = 200;
  ctx.body = {
    id: user.id,
    handle: user.handle,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    socials: user.socials,
  };
});

// ─── Search users ───────────────────────────────────────────────────────────
usersRouter.get("/search", async (ctx: Context) => {
  const q = String(ctx.query["q"] ?? "").trim().toLowerCase();
  if (!q || q.length < 2) {
    ctx.body = [];
    return;
  }

  const results: { id: string; handle: string; bio: string | null; avatarUrl: string | null; isPro: boolean }[] = [];
  for (const user of users.values()) {
    if (user.handle.includes(q)) {
      results.push({
        id: user.id,
        handle: user.handle,
        bio: user.bio ?? null,
        avatarUrl: user.avatarUrl ?? null,
        isPro: user.isPro,
      });
    }
    if (results.length >= 20) break;
  }

  ctx.body = results;
});

// ─── Follow system ──────────────────────────────────────────────────────────
const follows = new Map<string, Set<string>>(); // userId -> set of followed userIds
const followers = new Map<string, Set<string>>(); // userId -> set of follower userIds

usersRouter.post("/follow/:targetId", requireAuth(), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const targetId = ctx.params["targetId"]!;

  if (targetId === userId) {
    ctx.status = 400;
    ctx.body = { error: "cannot_follow_self" };
    return;
  }

  if (!usersById.has(targetId)) {
    ctx.status = 404;
    ctx.body = { error: "user_not_found" };
    return;
  }

  if (!follows.has(userId)) follows.set(userId, new Set());
  if (!followers.has(targetId)) followers.set(targetId, new Set());

  follows.get(userId)!.add(targetId);
  followers.get(targetId)!.add(userId);

  ctx.body = { following: true, followersCount: followers.get(targetId)!.size };
});

usersRouter.delete("/follow/:targetId", requireAuth(), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const targetId = ctx.params["targetId"]!;

  if (follows.has(userId)) follows.get(userId)!.delete(targetId);
  if (followers.has(targetId)) followers.get(targetId)!.delete(userId);

  ctx.body = { following: false, followersCount: followers.get(targetId)?.size ?? 0 };
});

usersRouter.get("/follow/:targetId", requireAuth(), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const targetId = ctx.params["targetId"]!;
  const isFollowing = follows.get(userId)?.has(targetId) ?? false;
  const followersCount = followers.get(targetId)?.size ?? 0;
  const followingCount = follows.get(targetId)?.size ?? 0;

  ctx.body = { isFollowing, followersCount, followingCount };
});

// ─── WebAuthn: Start registration ───────────────────────────────────────────
usersRouter.post("/me/passkey/register-options", requireAuth(), async (ctx: Context) => {
  const { userId } = ctx.state.user as AuthPayload;
  const user = usersById.get(userId);
  if (!user) { ctx.status = 404; ctx.body = { error: "user_not_found" }; return; }

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: user.handle,
    userDisplayName: user.handle,
    attestationType: "none",
    excludeCredentials: user.credentials.map((c) => ({
      id: c.id,
      transports: c.transports,
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
  const user = usersById.get(userId);
  if (!user) { ctx.status = 404; ctx.body = { error: "user_not_found" }; return; }

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
  user.credentials.push({
    id: credential.id,
    publicKey: credential.publicKey,
    counter: credential.counter,
    transports: body.response?.transports,
  });

  challenges.delete(userId);
  ctx.body = { verified: true };
});

// ─── WebAuthn: Start authentication ─────────────────────────────────────────
usersRouter.post("/auth/passkey/login-options", async (ctx: Context) => {
  const body = ctx.request.body as Record<string, unknown>;
  const handle = String(body.handle ?? "").trim().toLowerCase();
  const user = users.get(handle);

  if (!user || user.credentials.length === 0) {
    ctx.status = 400;
    ctx.body = { error: "no_passkey" };
    return;
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: user.credentials.map((c) => ({
      id: c.id,
      transports: c.transports,
    })),
    userVerification: "preferred",
  });

  challenges.set(user.id, options.challenge);
  ctx.body = options;
});

// ─── WebAuthn: Verify authentication ────────────────────────────────────────
usersRouter.post("/auth/passkey/login-verify", async (ctx: Context) => {
  const body = ctx.request.body as Record<string, unknown>;
  const handle = String(body.handle ?? "").trim().toLowerCase();
  const user = users.get(handle);

  if (!user) { ctx.status = 400; ctx.body = { error: "user_not_found" }; return; }

  const expectedChallenge = challenges.get(user.id);
  if (!expectedChallenge) { ctx.status = 400; ctx.body = { error: "no_challenge" }; return; }

  const credential = user.credentials.find((c) => c.id === (body.credential as any)?.id);
  if (!credential) { ctx.status = 400; ctx.body = { error: "credential_not_found" }; return; }

  const verification = await verifyAuthenticationResponse({
    response: body.credential as any,
    expectedChallenge,
    expectedOrigin: RP_ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports,
    },
  });

  if (!verification.verified) {
    ctx.status = 401;
    ctx.body = { error: "auth_failed" };
    return;
  }

  credential.counter = verification.authenticationInfo.newCounter;
  challenges.delete(user.id);

  const token = signToken({ userId: user.id, handle: user.handle });
  ctx.cookies.set("sl_token", token, {
    httpOnly: true,
    secure: ctx.protocol === "https",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  ctx.body = { token, user: { id: user.id, handle: user.handle } };
});

// ─── Magic Link: Request ────────────────────────────────────────────────────
usersRouter.post("/auth/magic-link", async (ctx: Context) => {
  const body = ctx.request.body as Record<string, unknown>;
  const email = String(body.email ?? "").trim().toLowerCase();

  let foundUser: StoredUser | undefined;
  for (const u of users.values()) {
    if (u.email === email) { foundUser = u; break; }
  }

  if (!foundUser) {
    // Don't reveal if email exists
    ctx.body = { sent: true };
    return;
  }

  const magicToken = nanoid(32);
  foundUser.magicLinkToken = magicToken;
  foundUser.magicLinkExpiresAt = Date.now() + 10 * 60 * 1000;

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
    // Still log the link as fallback for dev/sandbox
    console.log(`[MAGIC LINK] Fallback link for @${foundUser.handle}: ${magicLink}`);
  }

  ctx.body = { sent: true };
});

// ─── Magic Link: Verify ─────────────────────────────────────────────────────
usersRouter.post("/auth/magic-link/verify", async (ctx: Context) => {
  const body = ctx.request.body as Record<string, unknown>;
  const magicToken = String(body.token ?? "");

  let foundUser: StoredUser | undefined;
  for (const u of users.values()) {
    if (u.magicLinkToken === magicToken && u.magicLinkExpiresAt && u.magicLinkExpiresAt > Date.now()) {
      foundUser = u;
      break;
    }
  }

  if (!foundUser) {
    ctx.status = 401;
    ctx.body = { error: "invalid_or_expired_link" };
    return;
  }

  foundUser.magicLinkToken = undefined;
  foundUser.magicLinkExpiresAt = undefined;

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

// ─── Export for use in secrets routes ────────────────────────────────────────
export { users as userStore, usersById as userStoreById };
