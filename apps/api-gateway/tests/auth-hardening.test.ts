import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../src/index.js";
import db from "../src/db.js";
import { clearSuspensionCache } from "../src/middleware/auth.js";
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

async function signup(handle: string): Promise<{ token: string; userId: string }> {
  const res = await fetch(`${baseUrl}/v1/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle }),
  });
  expect(res.status).toBe(201);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const token = /sl_token=([^;]+)/.exec(setCookie)?.[1] ?? "";
  const body = await res.json();
  return { token, userId: body.user.id };
}

describe("Suspension enforcement", () => {
  it("returns 403 account_suspended for suspended users and recovers after lift", async () => {
    const { token, userId } = await signup("suspend-target");

    // Baseline: authed request works.
    const ok = await fetch(`${baseUrl}/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(ok.status).toBe(200);

    // Suspend (as the admin route does) and invalidate the cache.
    db.prepare(
      `INSERT INTO user_suspensions (id, user_id, reason, suspended_by, suspended_at) VALUES (?, ?, ?, ?, ?)`,
    ).run("test-susp-1", userId, "test", "admin", new Date().toISOString());
    clearSuspensionCache(userId);

    const blocked = await fetch(`${baseUrl}/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).error).toBe("account_suspended");

    // Lift the suspension → access restored.
    db.prepare(`UPDATE user_suspensions SET lifted_at = ? WHERE id = 'test-susp-1'`).run(
      new Date().toISOString(),
    );
    clearSuspensionCache(userId);

    const restored = await fetch(`${baseUrl}/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(restored.status).toBe(200);
  });
});

describe("Token revocation on logout", () => {
  it("rejects a JWT after logout", async () => {
    const { token } = await signup("logout-target");

    const before = await fetch(`${baseUrl}/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(before.status).toBe(200);

    const logout = await fetch(`${baseUrl}/v1/users/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(logout.status).toBe(200);

    const after = await fetch(`${baseUrl}/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(after.status).toBe(401);
  });
});

describe("Short-lived session token exchange", () => {
  it("mints a 15-minute token distinct from the session token", async () => {
    const { token } = await signup("exchange-target");

    const res = await fetch(`${baseUrl}/v1/users/auth/session-token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.token).not.toBe(token);
    expect(body.expiresIn).toBe(900);

    // The short-lived token authenticates.
    const me = await fetch(`${baseUrl}/v1/users/me`, {
      headers: { Authorization: `Bearer ${body.token}` },
    });
    expect(me.status).toBe(200);
  });
});

describe("SSE legacy token auth removed", () => {
  it("rejects ?token= query auth on /v1/dms/stream", async () => {
    const { token } = await signup("sse-target");
    const res = await fetch(`${baseUrl}/v1/dms/stream?token=${token}&conversationId=abc`);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("ticket_required");
  });
});

describe("GDPR deletion sweep", () => {
  it("erases user data once the grace period elapses", async () => {
    const { runDeletionSweep } = await import("../src/jobs/deletion.js");
    const { token, userId } = await signup("delete-target");

    // Request deletion, then backdate execute_at so it is due now.
    const req = await fetch(`${baseUrl}/v1/users/me/request-deletion`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(req.status).toBe(200);
    db.prepare(
      `UPDATE deletion_requests SET execute_at = ? WHERE user_id = ?`,
    ).run(new Date(Date.now() - 1000).toISOString(), userId);

    const processed = await runDeletionSweep();
    expect(processed).toBeGreaterThanOrEqual(1);

    const gone = db.prepare(`SELECT 1 FROM users WHERE id = ?`).get(userId);
    expect(gone).toBeUndefined();

    const auditEntry = db
      .prepare(`SELECT 1 FROM audit_log WHERE action = 'account_deleted' AND target_id = ?`)
      .get(userId);
    expect(auditEntry).toBeTruthy();
  });
});
