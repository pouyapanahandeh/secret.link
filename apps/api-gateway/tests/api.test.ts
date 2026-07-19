import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Koa from "koa";
import bodyParser from "koa-bodyparser";
import { router } from "../src/routes/index.js";
import type { Server } from "http";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = new Koa();
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

    // Reveal
    const revealRes = await fetch(`${baseUrl}/v1/secrets/${created.id}`);
    expect(revealRes.status).toBe(200);
    const revealed = await revealRes.json();
    expect(revealed.ciphertext).toBe("test-encrypted-data");
    expect(revealed.remainingViews).toBe(0);

    // Second reveal should fail (burned)
    const burnedRes = await fetch(`${baseUrl}/v1/secrets/${created.id}`);
    expect(burnedRes.status).toBe(410);
  });

  it("rejects invalid input", async () => {
    const res = await fetch(`${baseUrl}/v1/secrets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ciphertext: "", ttlSeconds: 10 }),
    });
    expect(res.status).toBe(400);
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
  });

  it("lists sitemap handles", async () => {
    const res = await fetch(`${baseUrl}/v1/users/sitemap-handles`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.handles)).toBe(true);
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
});
