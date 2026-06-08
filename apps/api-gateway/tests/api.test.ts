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
  it("returns 200 with ok status", async () => {
    const res = await fetch(`${baseUrl}/v1/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
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
    expect(body.handle).toBe("testuser");
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
