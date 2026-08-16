import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Koa from "koa";
import bodyParser from "koa-bodyparser";
import { router } from "../src/routes/index.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import type { Server } from "http";
import db from "../src/db.js";
import { signToken } from "../src/middleware/auth.js";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = new Koa();
  app.use(errorHandler());
  app.use(bodyParser());
  app.use(router.routes());
  app.use(router.allowedMethods());

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

afterAll(() => {
  server?.close();
});

describe("Health endpoint", () => {
  it("returns 200 with ok status and db check", async () => {
    const res = await fetch(`${baseUrl}/v1/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.checks?.db).toBe("ok");
    expect(body.timestamp).toBeTruthy();
  });
});

describe("Secrets API", () => {
  it("creates and reveals a secret", async () => {
    // Create
    const createRes = await fetch(`${baseUrl}/v1/secrets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ciphertext: "test-encrypted-data", ttlSeconds: 3600 }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.id).toBeTruthy();
    expect(created.expiresAt).toBeTruthy();

    // Reveal (burns)
    const revealRes = await fetch(`${baseUrl}/v1/secrets/${created.id}/reveal`, { method: "POST" });
    expect(revealRes.status).toBe(200);
    const revealed = await revealRes.json();
    expect(revealed.ciphertext).toBe("test-encrypted-data");
    expect(revealed.remainingViews).toBe(0);

    // Second reveal should fail (burned)
    const burnedRes = await fetch(`${baseUrl}/v1/secrets/${created.id}/reveal`, { method: "POST" });
    expect(burnedRes.status).toBe(410);
  });

  it("rejects invalid input with validation_error shape", async () => {
    const res = await fetch(`${baseUrl}/v1/secrets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ciphertext: "", ttlSeconds: 10 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation_error");
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it("returns 404 for non-existent secret", async () => {
    const res = await fetch(`${baseUrl}/v1/secrets/nonexistent`);
    expect(res.status).toBe(404);
  });
});

describe("Users API", () => {
  it("creates a user", async () => {
    const res = await fetch(`${baseUrl}/v1/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "testuser", email: "test@example.com" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.handle).toBe("testuser");
  });

  it("rejects duplicate handle", async () => {
    // First create
    await fetch(`${baseUrl}/v1/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "duplicate" }),
    });
    // Second create
    const res = await fetch(`${baseUrl}/v1/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "duplicate" }),
    });
    expect(res.status).toBe(409);
  });

  it("patches profile and serves public handle", async () => {
    const createRes = await fetch(`${baseUrl}/v1/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "profilepatch" }),
    });
    expect(createRes.status).toBe(201);
    const setCookie = createRes.headers.get("set-cookie") ?? "";
    const tokenMatch = /sl_token=([^;]+)/.exec(setCookie);
    expect(tokenMatch?.[1]).toBeTruthy();
    const token = decodeURIComponent(tokenMatch![1]!);

    const patchRes = await fetch(`${baseUrl}/v1/users/me/profile`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bio: "Hello world",
        socials: [{ platform: "instagram", url: "https://instagram.com/x" }],
        avatarUrl: "https://example.com/a.png",
      }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.bio).toBe("Hello world");
    expect(patched.avatarUrl).toBe("https://example.com/a.png");

    const publicRes = await fetch(`${baseUrl}/v1/users/profilepatch`);
    expect(publicRes.status).toBe(200);
    const pub = await publicRes.json();
    expect(pub.handle).toBe("profilepatch");
    expect(pub.bio).toBe("Hello world");
    // acceptsSecrets defaults to true (secret box shown) for existing users.
    expect(pub.acceptsSecrets).toBe(true);
  });

  it("toggles acceptsSecrets (secret box visibility)", async () => {
    const createRes = await fetch(`${baseUrl}/v1/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "secretbox" }),
    });
    expect(createRes.status).toBe(201);
    const setCookie = createRes.headers.get("set-cookie") ?? "";
    const token = decodeURIComponent(/sl_token=([^;]+)/.exec(setCookie)![1]!);

    // Default is true on the owner endpoint.
    const meRes = await fetch(`${baseUrl}/v1/users/me/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect((await meRes.json()).acceptsSecrets).toBe(true);

    // Disable the secret box.
    const patchRes = await fetch(`${baseUrl}/v1/users/me/profile`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ acceptsSecrets: false }),
    });
    expect(patchRes.status).toBe(200);
    expect((await patchRes.json()).acceptsSecrets).toBe(false);

    // Public profile now reflects the disabled secret box.
    const publicRes = await fetch(`${baseUrl}/v1/users/secretbox`);
    expect((await publicRes.json()).acceptsSecrets).toBe(false);

    // Re-enabling restores it, and does not clobber other fields.
    const reEnableRes = await fetch(`${baseUrl}/v1/users/me/profile`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ acceptsSecrets: true, bio: "still here" }),
    });
    const reEnabled = await reEnableRes.json();
    expect(reEnabled.acceptsSecrets).toBe(true);
    expect(reEnabled.bio).toBe("still here");
  });

  it("lists sitemap handles", async () => {
    const res = await fetch(`${baseUrl}/v1/users/sitemap-handles`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.handles)).toBe(true);
  });

  it("rejects invalid signup with validation_error", async () => {
    const res = await fetch(`${baseUrl}/v1/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "x" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation_error");
    expect(body.issues?.length).toBeGreaterThan(0);
  });

  it("rejects short search query with validation_error", async () => {
    const res = await fetch(`${baseUrl}/v1/users/search?q=a`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation_error");
  });

  it("follow and unfollow a user", async () => {
    const aRes = await fetch(`${baseUrl}/v1/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "followera" }),
    });
    const bRes = await fetch(`${baseUrl}/v1/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "followerb" }),
    });
    const a = (await aRes.json()) as { user: { id: string } };
    const b = (await bRes.json()) as { user: { id: string } };
    const token = decodeURIComponent(/sl_token=([^;]+)/.exec(aRes.headers.get("set-cookie") ?? "")?.[1] ?? "");

    const followRes = await fetch(`${baseUrl}/v1/users/follow/${b.user.id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(followRes.status).toBe(200);
    const followed = await followRes.json();
    expect(followed.following).toBe(true);

    const unfollowRes = await fetch(`${baseUrl}/v1/users/follow/${b.user.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(unfollowRes.status).toBe(200);
    const unfollowed = await unfollowRes.json();
    expect(unfollowed.following).toBe(false);
  });
});

describe("Workspaces API", () => {
  it("creates a workspace", async () => {
    const res = await fetch(`${baseUrl}/v1/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Acme Inc", slug: "acme", region: "us" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.slug).toBe("acme");
    expect(body.plan).toBe("free");
  });
});

describe("Map secrets encryption", () => {
  function encryptMapPayload(plaintext: string) {
    const { createCipheriv, randomBytes } = require("node:crypto") as typeof import("node:crypto");
    const key = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const ciphertext = Buffer.concat([encrypted, tag]);
    const toB64Url = (buf: Buffer) =>
      buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return {
      ciphertext: toB64Url(ciphertext),
      nonce: toB64Url(iv),
      key: toB64Url(key),
      plaintext,
    };
  }

  it("stores ciphertext only and returns key material on reveal", async () => {
    const payload = encryptMapPayload("hello map secret");
    const createRes = await fetch(`${baseUrl}/v1/secrets/map`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ciphertext: payload.ciphertext,
        nonce: payload.nonce,
        key: payload.key,
        lat: 51.5,
        lng: -0.12,
        emoji: "🤫",
        ttlMinutes: 60,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.id).toBeTruthy();
    expect(created.message).toBeUndefined();

    const listRes = await fetch(`${baseUrl}/v1/secrets/map`);
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    const listed = list.find((s: { id: string }) => s.id === created.id);
    expect(listed).toBeTruthy();
    expect(listed.message).toBeUndefined();
    expect(listed.ciphertext).toBeUndefined();
    expect(listed.key).toBeUndefined();

    const revealRes = await fetch(`${baseUrl}/v1/secrets/map/${created.id}/reveal`, {
      method: "POST",
    });
    expect(revealRes.status).toBe(200);
    const revealed = await revealRes.json();
    expect(revealed.ciphertext).toBe(payload.ciphertext);
    expect(revealed.nonce).toBe(payload.nonce);
    expect(revealed.key).toBeTruthy();
    expect(revealed.message).toBeUndefined();

    // Server DB must not contain plaintext in message/ciphertext columns.
    const db = (await import("../src/db.js")).default;
    const row = db.prepare("SELECT message, ciphertext FROM map_secrets WHERE id = ?").get(created.id) as {
      message: string;
      ciphertext: string;
    };
    expect(row.message).toBe("");
    expect(row.ciphertext).toBe(payload.ciphertext);
    expect(row.ciphertext).not.toContain(payload.plaintext);
  });

  it("rejects plaintext message posts", async () => {
    const res = await fetch(`${baseUrl}/v1/secrets/map`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "not encrypted",
        lat: 51.5,
        lng: -0.12,
        emoji: "💬",
        ttlMinutes: 60,
      }),
    });
    expect(res.status).toBe(400);
  });

  it("persists and lists cityName and countryName", async () => {
    const payload = encryptMapPayload("located story");
    const createRes = await fetch(`${baseUrl}/v1/secrets/map`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ciphertext: payload.ciphertext,
        nonce: payload.nonce,
        key: payload.key,
        lat: 47.5,
        lng: 19.0,
        emoji: "📍",
        ttlMinutes: 60,
        cityName: "Budapest",
        countryName: "Hungary",
        locationName: "Budapest, Hungary",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.cityName).toBe("Budapest");
    expect(created.countryName).toBe("Hungary");

    const listRes = await fetch(`${baseUrl}/v1/secrets/map`);
    const list = await listRes.json();
    const listed = list.find((s: { id: string }) => s.id === created.id);
    expect(listed?.cityName).toBe("Budapest");
    expect(listed?.countryName).toBe("Hungary");
  });
});

describe("Blog API", () => {
  async function createUser(handle: string) {
    const res = await fetch(`${baseUrl}/v1/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { user: { id: string; handle: string } };
    return body.user;
  }

  function authToken(userId: string, handle: string) {
    return signToken({ userId, handle });
  }

  function setRole(userId: string, role: string) {
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
  }

  it("rejects reserved blog handle at signup", async () => {
    const res = await fetch(`${baseUrl}/v1/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "blog" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("reserved_handle");
  });

  it("public endpoints return only published posts", async () => {
    const editor = await createUser("blogeditor");
    setRole(editor.id, "editor");
    const token = authToken(editor.id, editor.handle);

    const draftRes = await fetch(`${baseUrl}/v1/admin/blog-posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Draft Post",
        slug: "draft-post",
        excerpt: "Draft excerpt for SEO testing.",
        body: "Draft body content.",
        keywords: "privacy, draft",
        status: "draft",
      }),
    });
    expect(draftRes.status).toBe(201);

    const publishRes = await fetch(`${baseUrl}/v1/admin/blog-posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Published Post",
        slug: "published-post",
        excerpt: "Published excerpt for SEO testing.",
        body: "Published body content.",
        keywords: "privacy, ephemeral",
        status: "published",
      }),
    });
    expect(publishRes.status).toBe(201);

    const listRes = await fetch(`${baseUrl}/v1/public/blog`);
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as { posts: { slug: string }[] };
    expect(list.posts.some((p) => p.slug === "published-post")).toBe(true);
    expect(list.posts.some((p) => p.slug === "draft-post")).toBe(false);

    const draftPublicRes = await fetch(`${baseUrl}/v1/public/blog/draft-post`);
    expect(draftPublicRes.status).toBe(404);

    const publishedPublicRes = await fetch(`${baseUrl}/v1/public/blog/published-post`);
    expect(publishedPublicRes.status).toBe(200);
    const published = await publishedPublicRes.json();
    expect(published.title).toBe("Published Post");
    expect(published.body).toContain("Published body");
  });

  it("editor can create and publish; regular user gets 403", async () => {
    const editor = await createUser("blogeditor2");
    setRole(editor.id, "editor");
    const editorToken = authToken(editor.id, editor.handle);

    const createRes = await fetch(`${baseUrl}/v1/admin/blog-posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${editorToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Editor Post",
        slug: "editor-post",
        excerpt: "Editor can publish this post.",
        body: "Editor body.",
        status: "published",
      }),
    });
    expect(createRes.status).toBe(201);

    const regular = await createUser("regularuser");
    const regularToken = authToken(regular.id, regular.handle);
    const forbiddenRes = await fetch(`${baseUrl}/v1/admin/blog-posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${regularToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Nope",
        slug: "nope",
        excerpt: "Should fail",
        body: "No access",
      }),
    });
    expect(forbiddenRes.status).toBe(403);
  });

  it("admin can delete; editor cannot", async () => {
    const admin = await createUser("blogadmin");
    setRole(admin.id, "admin");
    const adminToken = authToken(admin.id, admin.handle);

    const editor = await createUser("blogeditor3");
    setRole(editor.id, "editor");
    const editorToken = authToken(editor.id, editor.handle);

    const createRes = await fetch(`${baseUrl}/v1/admin/blog-posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${editorToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Delete Me",
        slug: "delete-me",
        excerpt: "Temporary post",
        body: "Body",
        status: "draft",
      }),
    });
    const created = (await createRes.json()) as { id: string };

    const editorDeleteRes = await fetch(`${baseUrl}/v1/admin/blog-posts/${created.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${editorToken}` },
    });
    expect(editorDeleteRes.status).toBe(403);

    const adminDeleteRes = await fetch(`${baseUrl}/v1/admin/blog-posts/${created.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(adminDeleteRes.status).toBe(200);
  });

  it("validates slug uniqueness and format", async () => {
    const editor = await createUser("blogeditor4");
    setRole(editor.id, "editor");
    const token = authToken(editor.id, editor.handle);

    const first = await fetch(`${baseUrl}/v1/admin/blog-posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Unique Slug",
        slug: "unique-slug",
        excerpt: "First post",
        body: "Body",
      }),
    });
    expect(first.status).toBe(201);

    const duplicate = await fetch(`${baseUrl}/v1/admin/blog-posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Unique Slug Again",
        slug: "unique-slug",
        excerpt: "Second post",
        body: "Body",
      }),
    });
    expect(duplicate.status).toBe(201);
    const dupBody = await duplicate.json();
    expect(dupBody.slug).not.toBe("unique-slug");

    const invalid = await fetch(`${baseUrl}/v1/admin/blog-posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Bad Slug",
        slug: "Bad Slug!",
        excerpt: "Invalid",
        body: "Body",
      }),
    });
    expect(invalid.status).toBe(400);
  });

  it("returns sitemap slugs for published posts", async () => {
    const res = await fetch(`${baseUrl}/v1/public/blog/sitemap-slugs`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { slugs: { slug: string; updatedAt: string }[] };
    expect(Array.isArray(body.slugs)).toBe(true);
    if (body.slugs.length > 0) {
      expect(body.slugs[0]?.slug).toBeTruthy();
      expect(body.slugs[0]?.updatedAt).toBeTruthy();
    }
  });
});

describe("Multi-device DM keys", () => {
  async function signup(handle: string): Promise<string> {
    const res = await fetch(`${baseUrl}/v1/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
    });
    expect(res.status).toBe(201);
    const setCookie = res.headers.get("set-cookie") ?? "";
    const tokenMatch = /sl_token=([^;]+)/.exec(setCookie);
    expect(tokenMatch?.[1]).toBeTruthy();
    return decodeURIComponent(tokenMatch![1]!);
  }

  it("upserts distinct device keys without overwriting", async () => {
    const token = await signup(`mdkeys_${Date.now().toString(36)}`);
    const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    const a = await fetch(`${baseUrl}/v1/dms/keys`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ publicKey: "pubAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa=", deviceId: "laptop" }),
    });
    expect(a.status).toBe(200);

    const b = await fetch(`${baseUrl}/v1/dms/keys`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ publicKey: "pubBbbbbbbbbbbbbbbbbbbbbbbbbbbbbb=", deviceId: "phone" }),
    });
    expect(b.status).toBe(200);

    const list = await fetch(`${baseUrl}/v1/dms/keys`, { headers: { Authorization: `Bearer ${token}` } });
    expect(list.status).toBe(200);
    const body = await list.json();
    expect(body.publicKeys).toHaveLength(2);
    expect(body.devices.map((d: { deviceId: string }) => d.deviceId).sort()).toEqual(["laptop", "phone"]);
  });

  it("rejects a 6th device with 409 device_limit", async () => {
    const token = await signup(`mdlimit_${Date.now().toString(36)}`);
    const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${baseUrl}/v1/dms/keys`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({ publicKey: `key${i}${"x".repeat(40)}`, deviceId: `dev${i}` }),
      });
      expect(res.status).toBe(200);
    }
    const sixth = await fetch(`${baseUrl}/v1/dms/keys`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ publicKey: `key5${"x".repeat(40)}`, deviceId: "dev5" }),
    });
    expect(sixth.status).toBe(409);
    const body = await sixth.json();
    expect(body.error).toBe("device_limit");
  });

  it("revokes a device and exposes dmPublicKeys on profile", async () => {
    const handle = `mdprof_${Date.now().toString(36)}`;
    const token = await signup(handle);
    const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    await fetch(`${baseUrl}/v1/dms/keys`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ publicKey: "profKeyLaptopxxxxxxxxxxxxxxxxxxxxxxx=", deviceId: "laptop" }),
    });
    await fetch(`${baseUrl}/v1/dms/keys`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ publicKey: "profKeyPhonexxxxxxxxxxxxxxxxxxxxxxxx=", deviceId: "phone" }),
    });

    const del = await fetch(`${baseUrl}/v1/dms/keys/device/phone`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(del.status).toBe(200);

    const profile = await fetch(`${baseUrl}/v1/users/${handle}`);
    expect(profile.status).toBe(200);
    const pub = await profile.json();
    expect(pub.dmPublicKeys).toEqual(["profKeyLaptopxxxxxxxxxxxxxxxxxxxxxxx="]);
    expect(pub.dmPublicKey).toBe("profKeyLaptopxxxxxxxxxxxxxxxxxxxxxxx=");
  });

  it("stores wraps[] on create and returns them on reveal", async () => {
    const createRes = await fetch(`${baseUrl}/v1/secrets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ciphertext: "multi-wrap-cipher",
        ttlSeconds: 3600,
        recipientHandle: "anyone",
        nonce: "nonce1",
        wraps: [
          { wrappedKey: "w1", wrapNonce: "n1", wrapEpk: "e1" },
          { wrappedKey: "w2", wrapNonce: "n2", wrapEpk: "e2" },
        ],
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    const revealRes = await fetch(`${baseUrl}/v1/secrets/${created.id}/reveal`, { method: "POST" });
    expect(revealRes.status).toBe(200);
    const revealed = await revealRes.json();
    expect(revealed.wraps).toHaveLength(2);
    expect(revealed.wrappedKey).toBe("w1");
    expect(revealed.wrapNonce).toBe("n1");
    expect(revealed.wrapEpk).toBe("e1");
  });
});
