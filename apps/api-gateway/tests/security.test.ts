import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../src/index.js";
import type { Server } from "http";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
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

describe("CORS", () => {
  it("allows configured origin", async () => {
    const res = await fetch(`${baseUrl}/v1/health`, {
      headers: { Origin: "http://localhost:3000" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("rejects unknown origin", async () => {
    const res = await fetch(`${baseUrl}/v1/health`, {
      headers: { Origin: "http://evil.com" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeFalsy();
  });
});

describe("Authentication", () => {
  it("rejects unauthenticated access to inbox", async () => {
    const res = await fetch(`${baseUrl}/v1/secrets/inbox/someuser`);
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated access to sent", async () => {
    const res = await fetch(`${baseUrl}/v1/secrets/sent/someid`);
    expect(res.status).toBe(401);
  });

  it("signup sets HttpOnly cookie and does not return token in body", async () => {
    const res = await fetch(`${baseUrl}/v1/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "sectest" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token).toBeUndefined();
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("sl_token=");
    expect(setCookie).toContain("httponly");
  });

  it("forbids inbox access by different user", async () => {
    // Create user A
    const aRes = await fetch(`${baseUrl}/v1/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "usera" }),
    });
    const aCookie = aRes.headers.get("set-cookie")?.split(";")[0] ?? "";

    // Try to access user B's inbox with user A's cookie
    const res = await fetch(`${baseUrl}/v1/secrets/inbox/userb`, {
      headers: { Cookie: aCookie },
    });
    expect(res.status).toBe(403);
  });
});

describe("Rate limiting", () => {
  it("sets rate limit headers", async () => {
    const res = await fetch(`${baseUrl}/v1/health`);
    expect(res.headers.get("x-ratelimit-limit")).toBeTruthy();
    expect(res.headers.get("x-ratelimit-remaining")).toBeTruthy();
  });
});
