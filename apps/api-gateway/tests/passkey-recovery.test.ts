import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../src/index.js";
import db from "../src/db.js";
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

let ipSeq = 10;
function nextIp(): string {
  ipSeq += 1;
  return `203.0.113.${ipSeq}`;
}

function uniqueHandle(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 32);
}

async function signup(handle: string, ip = nextIp()): Promise<{ token: string; userId: string }> {
  const res = await fetch(`${baseUrl}/v1/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
    body: JSON.stringify({ handle }),
  });
  expect(res.status).toBe(201);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const token = decodeURIComponent(/sl_token=([^;]+)/.exec(setCookie)?.[1] ?? "");
  const body = (await res.json()) as { user: { id: string } };
  return { token, userId: body.user.id };
}

function authHeaders(token: string, ip = nextIp()): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Forwarded-For": ip,
  };
}

function insertCredential(userId: string, id = `cred_${Math.random().toString(36).slice(2, 10)}`): string {
  db.prepare(
    `INSERT INTO credentials (id, user_id, public_key, counter, transports, created_at) VALUES (?, ?, ?, 0, '[]', ?)`,
  ).run(id, userId, Buffer.from("fake-pk"), new Date().toISOString());
  return id;
}

describe("passkey list and delete", () => {
  it("lists metadata only and never public_key", async () => {
    const handle = uniqueHandle("pkl");
    const { token, userId } = await signup(handle);
    insertCredential(userId, "cred_list_a");
    insertCredential(userId, "cred_list_b");

    const res = await fetch(`${baseUrl}/v1/users/me/passkeys`, { headers: authHeaders(token) });
    expect(res.status).toBe(200);
    const raw = await res.text();
    expect(raw).not.toContain("public_key");
    expect(raw).not.toContain("fake-pk");
    const body = JSON.parse(raw) as { passkeys: Array<{ id: string; createdAt: string | null }> };
    expect(body.passkeys).toHaveLength(2);
    expect(body.passkeys.map((p) => p.id).sort()).toEqual(["cred_list_a", "cred_list_b"]);
  });

  it("blocks deleting the last passkey without unused recovery codes", async () => {
    const handle = uniqueHandle("pkd");
    const { token, userId } = await signup(handle);
    const id = insertCredential(userId);

    const blocked = await fetch(`${baseUrl}/v1/users/me/passkeys/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    expect(blocked.status).toBe(400);
    expect((await blocked.json()).error).toBe("last_passkey");
  });

  it("allows deleting the last passkey when unused recovery codes exist", async () => {
    const handle = uniqueHandle("pkc");
    const { token, userId } = await signup(handle);
    const id = insertCredential(userId);

    const rotated = await fetch(`${baseUrl}/v1/users/me/recovery-codes/rotate`, {
      method: "POST",
      headers: authHeaders(token),
    });
    expect(rotated.status).toBe(200);

    const deleted = await fetch(`${baseUrl}/v1/users/me/passkeys/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    expect(deleted.status).toBe(200);
    expect((await deleted.json()).ok).toBe(true);
  });
});

describe("recovery codes", () => {
  it("rotates unused codes, consumes one, and rejects reuse", async () => {
    const handle = uniqueHandle("rcv");
    const { token } = await signup(handle);
    const ip = nextIp();

    const rotated = await fetch(`${baseUrl}/v1/users/me/recovery-codes/rotate`, {
      method: "POST",
      headers: authHeaders(token, ip),
    });
    expect(rotated.status).toBe(200);
    const { recoveryCodes } = (await rotated.json()) as { recoveryCodes: string[] };
    expect(recoveryCodes).toHaveLength(10);
    expect(recoveryCodes[0]).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    const first = await fetch(`${baseUrl}/v1/users/auth/recovery-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: JSON.stringify({ handle, code: recoveryCodes[0] }),
    });
    expect(first.status).toBe(200);
    const { token: scoped } = (await first.json()) as { token: string };
    expect(scoped).toBeTruthy();

    const reuse = await fetch(`${baseUrl}/v1/users/auth/recovery-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: JSON.stringify({ handle, code: recoveryCodes[0] }),
    });
    expect(reuse.status).toBe(401);
    expect((await reuse.json()).error).toBe("invalid_recovery");
  });

  it("writes recovery_code_used without storing the plaintext code", async () => {
    const handle = uniqueHandle("aud");
    const { token, userId } = await signup(handle);
    const ip = nextIp();

    const rotated = await fetch(`${baseUrl}/v1/users/me/recovery-codes/rotate`, {
      method: "POST",
      headers: authHeaders(token, ip),
    });
    const { recoveryCodes } = (await rotated.json()) as { recoveryCodes: string[] };
    const code = recoveryCodes[0]!;

    const recovered = await fetch(`${baseUrl}/v1/users/auth/recovery-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: JSON.stringify({ handle, code }),
    });
    const raw = await recovered.text();
    expect(recovered.status).toBe(200);
    expect(raw).not.toContain(code);

    const row = db.prepare(
      `SELECT action, actor_id, target_id, details FROM audit_log WHERE actor_id = ? AND action = 'recovery_code_used' ORDER BY created_at DESC LIMIT 1`,
    ).get(userId) as { action: string; actor_id: string; target_id: string; details: string } | undefined;
    expect(row).toBeTruthy();
    expect(row?.actor_id).toBe(userId);
    expect(row?.target_id).toBe(userId);
    expect(row?.details).toBe(JSON.stringify({ ip }));
    expect(row?.details).not.toContain(code);
    expect(JSON.stringify(row)).not.toContain(code);
  });

  it("returns the same invalid_recovery error for an unknown handle", async () => {
    const ip = nextIp();
    const res = await fetch(`${baseUrl}/v1/users/auth/recovery-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: JSON.stringify({ handle: uniqueHandle("nope"), code: "AAAA-BBBB" }),
    });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("invalid_recovery");
  });

  it("accepts a pasted list and uses the first recovery code", async () => {
    const handle = uniqueHandle("pst");
    const { token } = await signup(handle);
    const ip = nextIp();

    const rotated = await fetch(`${baseUrl}/v1/users/me/recovery-codes/rotate`, {
      method: "POST",
      headers: authHeaders(token, ip),
    });
    const { recoveryCodes } = (await rotated.json()) as { recoveryCodes: string[] };

    const recovered = await fetch(`${baseUrl}/v1/users/auth/recovery-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: JSON.stringify({ handle, code: recoveryCodes.join("\n") }),
    });
    expect(recovered.status).toBe(200);
    expect(((await recovered.json()) as { token?: string }).token).toBeTruthy();
  });

  it("scoped token cannot hit profile mutations or /me", async () => {
    const handle = uniqueHandle("scp");
    const { token } = await signup(handle);
    const ip = nextIp();

    const rotated = await fetch(`${baseUrl}/v1/users/me/recovery-codes/rotate`, {
      method: "POST",
      headers: authHeaders(token, ip),
    });
    const { recoveryCodes } = (await rotated.json()) as { recoveryCodes: string[] };

    const recovered = await fetch(`${baseUrl}/v1/users/auth/recovery-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: JSON.stringify({ handle, code: recoveryCodes[1] }),
    });
    expect(recovered.status).toBe(200);
    const { token: scoped } = (await recovered.json()) as { token: string };

    const me = await fetch(`${baseUrl}/v1/users/me`, { headers: authHeaders(scoped, ip) });
    expect(me.status).toBe(403);
    expect((await me.json()).error).toBe("insufficient_scope");

    const patch = await fetch(`${baseUrl}/v1/users/me/profile`, {
      method: "PATCH",
      headers: authHeaders(scoped, ip),
      body: JSON.stringify({ bio: "nope" }),
    });
    expect(patch.status).toBe(403);

    const profile = await fetch(`${baseUrl}/v1/users/me/profile`, { headers: authHeaders(scoped, ip) });
    expect(profile.status).toBe(200);
    const body = (await profile.json()) as { enrollmentRequired?: boolean; hasRecoveryCodes?: boolean };
    expect(body.enrollmentRequired).toBe(true);
  });

  it("returns 429 after too many recovery attempts", async () => {
    const ip = nextIp();
    const handle = uniqueHandle("lim");
    let lastStatus = 0;
    for (let i = 0; i < 6; i++) {
      const res = await fetch(`${baseUrl}/v1/users/auth/recovery-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
        body: JSON.stringify({ handle, code: "AAAA-BBBB" }),
      });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
