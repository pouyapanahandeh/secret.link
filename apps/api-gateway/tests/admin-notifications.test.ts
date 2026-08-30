import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Koa from "koa";
import bodyParser from "koa-bodyparser";
import { router } from "../src/routes/index.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { optionalAuth, signToken } from "../src/middleware/auth.js";
import type { Server } from "http";
import db from "../src/db.js";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = new Koa();
  app.use(errorHandler());
  app.use(bodyParser());
  app.use(optionalAuth());
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

async function createUser(prefix: string) {
  const handle = `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const res = await fetch(`${baseUrl}/v1/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle }),
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { user: { id: string; handle: string } };
  return body.user;
}

function authHeaders(userId: string, handle: string) {
  return {
    Authorization: `Bearer ${signToken({ userId, handle })}`,
    "Content-Type": "application/json",
  };
}

function setRole(userId: string, role: string) {
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
}

describe("Admin notifications", () => {
  it("sends to a single handle and writes inbox + campaign + audit", async () => {
    const admin = await createUser("nadmin");
    const target = await createUser("ntarget");
    setRole(admin.id, "admin");

    const previewRes = await fetch(`${baseUrl}/v1/admin/notifications/preview`, {
      method: "POST",
      headers: authHeaders(admin.id, admin.handle),
      body: JSON.stringify({ audience: { mode: "handle", handle: target.handle } }),
    });
    expect(previewRes.status).toBe(200);
    const preview = (await previewRes.json()) as { count: number; sampleHandles: string[] };
    expect(preview.count).toBe(1);
    expect(preview.sampleHandles).toContain(target.handle);

    const sendRes = await fetch(`${baseUrl}/v1/admin/notifications`, {
      method: "POST",
      headers: authHeaders(admin.id, admin.handle),
      body: JSON.stringify({
        audience: { mode: "handle", handle: target.handle },
        title: "Heads up",
        body: "Please update your passkey.",
        confirmCount: 1,
      }),
    });
    expect(sendRes.status).toBe(200);
    const sent = (await sendRes.json()) as { ok: boolean; sent: number; id: string };
    expect(sent.ok).toBe(true);
    expect(sent.sent).toBe(1);

    const row = db
      .prepare("SELECT type, data FROM notifications WHERE user_id = ? AND type = 'admin' ORDER BY created_at DESC")
      .get(target.id) as { type: string; data: string };
    expect(row.type).toBe("admin");
    const data = JSON.parse(row.data) as { title: string; body: string; campaignId: string };
    expect(data.title).toBe("Heads up");
    expect(data.body).toBe("Please update your passkey.");
    expect(data.campaignId).toBe(sent.id);

    const campaign = db
      .prepare("SELECT recipient_count, audience_summary FROM admin_notification_campaigns WHERE id = ?")
      .get(sent.id) as { recipient_count: number; audience_summary: string };
    expect(campaign.recipient_count).toBe(1);
    expect(campaign.audience_summary).toContain(target.handle);

    const audit = db
      .prepare("SELECT 1 FROM audit_log WHERE action = 'admin_notification_sent' AND target_id = ?")
      .get(sent.id);
    expect(audit).toBeTruthy();
  });

  it("rejects moderator broadcasts", async () => {
    const mod = await createUser("nmod");
    setRole(mod.id, "moderator");

    const res = await fetch(`${baseUrl}/v1/admin/notifications/preview`, {
      method: "POST",
      headers: authHeaders(mod.id, mod.handle),
      body: JSON.stringify({ audience: { mode: "all" } }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("forbidden");
  });

  it("allows a moderator to notify one handle", async () => {
    const mod = await createUser("nmodok");
    const target = await createUser("nmodtgt");
    setRole(mod.id, "moderator");

    const sendRes = await fetch(`${baseUrl}/v1/admin/notifications`, {
      method: "POST",
      headers: authHeaders(mod.id, mod.handle),
      body: JSON.stringify({
        audience: { mode: "handle", handle: `@${target.handle}` },
        title: "Mod note",
        body: "Please check your reports.",
        confirmCount: 1,
      }),
    });
    expect(sendRes.status).toBe(200);
    const sent = (await sendRes.json()) as { sent: number };
    expect(sent.sent).toBe(1);
  });

  it("returns 400 for an empty audience and 409 when confirmCount does not match", async () => {
    const admin = await createUser("nempty");
    setRole(admin.id, "admin");

    const emptySend = await fetch(`${baseUrl}/v1/admin/notifications`, {
      method: "POST",
      headers: authHeaders(admin.id, admin.handle),
      body: JSON.stringify({
        audience: { mode: "handle", handle: "no-such-user-zzz" },
        title: "Hi",
        body: "Nobody here.",
        confirmCount: 0,
      }),
    });
    expect(emptySend.status).toBe(400);
    const emptyBody = (await emptySend.json()) as { error: string };
    expect(emptyBody.error).toBe("empty_audience");

    const target = await createUser("nmismatch");
    const mismatch = await fetch(`${baseUrl}/v1/admin/notifications`, {
      method: "POST",
      headers: authHeaders(admin.id, admin.handle),
      body: JSON.stringify({
        audience: { mode: "handle", handle: target.handle },
        title: "Hi",
        body: "Wrong count.",
        confirmCount: 99,
      }),
    });
    expect(mismatch.status).toBe(409);
    const mismatchBody = (await mismatch.json()) as { error: string };
    expect(mismatchBody.error).toBe("count_mismatch");
  });

  it("rejects invalid copy with validation_error", async () => {
    const admin = await createUser("nvalid");
    setRole(admin.id, "admin");
    const res = await fetch(`${baseUrl}/v1/admin/notifications`, {
      method: "POST",
      headers: authHeaders(admin.id, admin.handle),
      body: JSON.stringify({
        audience: { mode: "all" },
        title: "",
        body: "",
        confirmCount: 1,
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("validation_error");
  });

  it("lists recent campaigns", async () => {
    const admin = await createUser("nlist");
    const target = await createUser("nlistt");
    setRole(admin.id, "admin");
    await fetch(`${baseUrl}/v1/admin/notifications`, {
      method: "POST",
      headers: authHeaders(admin.id, admin.handle),
      body: JSON.stringify({
        audience: { mode: "handle", handle: target.handle },
        title: "Listed",
        body: "History row.",
        confirmCount: 1,
      }),
    });

    const listRes = await fetch(`${baseUrl}/v1/admin/notifications`, {
      headers: authHeaders(admin.id, admin.handle),
    });
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as { campaigns: Array<{ title: string }>; total: number };
    expect(list.total).toBeGreaterThan(0);
    expect(list.campaigns.some((row) => row.title === "Listed")).toBe(true);
  });
});
