import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Koa from "koa";
import bodyParser from "koa-bodyparser";
import { router } from "../src/routes/index.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { optionalAuth, signToken } from "../src/middleware/auth.js";
import type { Server } from "http";
import db from "../src/db.js";
import { runChatExpirySweep } from "../src/jobs/chat-expiry.js";

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

async function createChat(body: Record<string, unknown>) {
  const res = await fetch(`${baseUrl}/v1/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { res, json: await res.json() };
}

describe("Chats API", () => {
  it("creates a room and returns status without ciphertext", async () => {
    const { res, json } = await createChat({
      ttlSeconds: 3600,
      maxMembers: 5,
      displayName: "creator",
      anonymous: true,
    });
    expect(res.status).toBe(201);
    expect(json.id).toBeTruthy();
    expect(json.expiresAt).toBeTruthy();
    expect(json.token).toBeTruthy();
    expect(json.memberId).toBeTruthy();

    const statusRes = await fetch(`${baseUrl}/v1/chats/${json.id}`);
    expect(statusRes.status).toBe(200);
    const status = await statusRes.json();
    expect(status.hasPin).toBe(false);
    expect(status.pinLength).toBeNull();
    expect(status.memberCount).toBe(1);
    expect(status.maxMembers).toBe(5);
    expect(status.available).toBe(true);
    expect(status.ciphertext).toBeUndefined();
  });

  it("requires a PIN to join when one was set", async () => {
    const { json } = await createChat({
      ttlSeconds: 3600,
      maxMembers: 5,
      pin: "2468",
    });
    const statusRes = await fetch(`${baseUrl}/v1/chats/${json.id}`);
    expect((await statusRes.json()).pinLength).toBe(4);

    const noPin = await fetch(`${baseUrl}/v1/chats/${json.id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "guest" }),
    });
    expect(noPin.status).toBe(404);
    expect((await noPin.json()).error).toBe("not_found");

    const wrong = await fetch(`${baseUrl}/v1/chats/${json.id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "guest", pin: "0000" }),
    });
    expect(wrong.status).toBe(404);

    const ok = await fetch(`${baseUrl}/v1/chats/${json.id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "guest", pin: "2468" }),
    });
    expect(ok.status).toBe(200);
    const joined = await ok.json();
    expect(joined.token).toBeTruthy();
    expect(joined.memberId).toBeTruthy();
  });

  it("reports pinLength from the PIN that was set", async () => {
    const { json } = await createChat({
      ttlSeconds: 3600,
      maxMembers: 5,
      pin: "135790",
    });
    const statusRes = await fetch(`${baseUrl}/v1/chats/${json.id}`);
    expect((await statusRes.json()).pinLength).toBe(6);
  });

  it("rejects joins once the member cap is reached", async () => {
    const { json } = await createChat({
      ttlSeconds: 3600,
      maxMembers: 2,
      displayName: "one",
      anonymous: true,
    });

    const second = await fetch(`${baseUrl}/v1/chats/${json.id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "two" }),
    });
    expect(second.status).toBe(200);

    const third = await fetch(`${baseUrl}/v1/chats/${json.id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "three" }),
    });
    expect(third.status).toBe(409);
    expect((await third.json()).error).toBe("room_full");
  });

  it("stores only ciphertext and refuses messages without a join token", async () => {
    const { json } = await createChat({
      ttlSeconds: 3600,
      maxMembers: 5,
      displayName: "writer",
      anonymous: true,
    });
    const plaintext = "this must never hit the db in plaintext";
    const ciphertext = "Y2lwaGVydGV4dC1ub3QtcGxhaW50ZXh0";
    const nonce = "bm9uY2UxMjM";

    const unauth = await fetch(`${baseUrl}/v1/chats/${json.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ciphertext, nonce }),
    });
    expect(unauth.status).toBe(401);

    const posted = await fetch(`${baseUrl}/v1/chats/${json.id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Chat-Token": json.token,
      },
      body: JSON.stringify({ ciphertext, nonce }),
    });
    expect(posted.status).toBe(201);

    const row = db.prepare(`SELECT ciphertext FROM chat_messages WHERE room_id = ?`).get(json.id) as {
      ciphertext: string;
    };
    expect(row.ciphertext).toBe(ciphertext);
    expect(row.ciphertext).not.toContain(plaintext);

    const list = await fetch(`${baseUrl}/v1/chats/${json.id}/messages`, {
      headers: { "X-Chat-Token": json.token },
    });
    expect(list.status).toBe(200);
    const body = await list.json();
    expect(body.messages[0].ciphertext).toBe(ciphertext);
    expect(JSON.stringify(body)).not.toContain(plaintext);
  });

  it("returns 410 and hard-deletes an expired room", async () => {
    const { json } = await createChat({
      ttlSeconds: 3600,
      maxMembers: 5,
      displayName: "soon",
      anonymous: true,
    });
    db.prepare(`UPDATE chat_rooms SET expires_at = ? WHERE id = ?`).run("2000-01-01T00:00:00.000Z", json.id);

    const statusRes = await fetch(`${baseUrl}/v1/chats/${json.id}`);
    expect(statusRes.status).toBe(410);

    const leftover = db.prepare(`SELECT COUNT(*) AS c FROM chat_rooms WHERE id = ?`).get(json.id) as { c: number };
    expect(leftover.c).toBe(0);
    const msgs = db.prepare(`SELECT COUNT(*) AS c FROM chat_messages WHERE room_id = ?`).get(json.id) as { c: number };
    expect(msgs.c).toBe(0);
    const members = db.prepare(`SELECT COUNT(*) AS c FROM chat_members WHERE room_id = ?`).get(json.id) as {
      c: number;
    };
    expect(members.c).toBe(0);
  });

  it("sweep removes expired rooms from all three tables", async () => {
    const { json } = await createChat({
      ttlSeconds: 3600,
      maxMembers: 5,
      displayName: "sweep",
      anonymous: true,
    });
    await fetch(`${baseUrl}/v1/chats/${json.id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Chat-Token": json.token,
      },
      body: JSON.stringify({ ciphertext: "Y3Q", nonce: "bm8" }),
    });
    db.prepare(`UPDATE chat_rooms SET expires_at = ? WHERE id = ?`).run("2000-01-01T00:00:00.000Z", json.id);

    const purged = runChatExpirySweep();
    expect(purged).toBeGreaterThanOrEqual(1);
    expect(db.prepare(`SELECT 1 FROM chat_rooms WHERE id = ?`).get(json.id)).toBeUndefined();
    expect(db.prepare(`SELECT 1 FROM chat_members WHERE room_id = ?`).get(json.id)).toBeUndefined();
    expect(db.prepare(`SELECT 1 FROM chat_messages WHERE room_id = ?`).get(json.id)).toBeUndefined();
  });

  it("rejects invalid PIN and member counts", async () => {
    const shortPin = await createChat({ ttlSeconds: 3600, maxMembers: 5, pin: "12" });
    expect(shortPin.res.status).toBe(400);

    const tooMany = await createChat({ ttlSeconds: 3600, maxMembers: 99 });
    expect(tooMany.res.status).toBe(400);
  });

  it("lists and resumes identity memberships for signed-in users", async () => {
    const handleA = `chata${Date.now().toString(36)}`;
    const handleB = `chatb${Date.now().toString(36)}`;
    const signupA = await fetch(`${baseUrl}/v1/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: handleA }),
    });
    const signupB = await fetch(`${baseUrl}/v1/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: handleB }),
    });
    expect(signupA.status).toBe(201);
    expect(signupB.status).toBe(201);
    const userA = (await signupA.json()).user as { id: string; handle: string };
    const userB = (await signupB.json()).user as { id: string; handle: string };
    const tokenA = signToken({ userId: userA.id, handle: userA.handle });
    const tokenB = signToken({ userId: userB.id, handle: userB.handle });
    const authA = { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" };
    const authB = { Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" };

    const unauthMine = await fetch(`${baseUrl}/v1/chats/mine`);
    expect(unauthMine.status).toBe(401);

    const created = await fetch(`${baseUrl}/v1/chats`, {
      method: "POST",
      headers: authA,
      body: JSON.stringify({
        ttlSeconds: 3600,
        maxMembers: 5,
        displayName: `@${userA.handle}`,
        anonymous: false,
      }),
    });
    expect(created.status).toBe(201);
    const room = await created.json();

    const now = new Date().toISOString();
    const later = new Date(Date.now() + 3600_000).toISOString();
    db.prepare(
      `INSERT INTO chat_members (id, room_id, display_name, is_anonymous, user_id, joined_at)
       VALUES (?, ?, ?, 0, ?, ?)`,
    ).run(`mem-b-${userB.id}`, room.id, `@${userB.handle}`, userB.id, now);
    db.prepare(`UPDATE chat_rooms SET member_count = member_count + 1 WHERE id = ?`).run(room.id);

    const anonId = `anon-${userA.id.slice(0, 8)}`;
    db.prepare(
      `INSERT INTO chat_rooms (id, pin_hash, pin_length, max_members, member_count, created_at, expires_at)
       VALUES (?, NULL, NULL, 5, 1, ?, ?)`,
    ).run(anonId, now, later);
    db.prepare(
      `INSERT INTO chat_members (id, room_id, display_name, is_anonymous, user_id, joined_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
    ).run(`mem-anon-${userA.id}`, anonId, "anon", userA.id, now);

    const mineA = await fetch(`${baseUrl}/v1/chats/mine`, { headers: authA });
    expect(mineA.status).toBe(200);
    const listedA = (await mineA.json()) as { items: Array<{ id: string }> };
    const idsA = listedA.items.map((i) => i.id);
    expect(idsA).toContain(room.id);
    expect(idsA).not.toContain(anonId);

    const mineB = await fetch(`${baseUrl}/v1/chats/mine`, { headers: authB });
    const idsB = ((await mineB.json()) as { items: Array<{ id: string }> }).items.map((i) => i.id);
    expect(idsB).toContain(room.id);

    const membersBefore = db.prepare(`SELECT COUNT(*) AS c FROM chat_members WHERE room_id = ?`).get(room.id) as {
      c: number;
    };
    const resume = await fetch(`${baseUrl}/v1/chats/${room.id}/resume`, {
      method: "POST",
      headers: authB,
    });
    expect(resume.status).toBe(200);
    const resumed = await resume.json();
    expect(resumed.memberId).toBe(`mem-b-${userB.id}`);
    expect(resumed.token).toBeTruthy();
    const membersAfter = db.prepare(`SELECT COUNT(*) AS c FROM chat_members WHERE room_id = ?`).get(room.id) as {
      c: number;
    };
    expect(membersAfter.c).toBe(membersBefore.c);

    const stranger = await fetch(`${baseUrl}/v1/chats/${anonId}/resume`, {
      method: "POST",
      headers: authB,
    });
    expect(stranger.status).toBe(404);

    db.prepare(`UPDATE chat_rooms SET expires_at = ? WHERE id = ?`).run("2000-01-01T00:00:00.000Z", room.id);
    const mineExpired = await fetch(`${baseUrl}/v1/chats/mine`, { headers: authA });
    const expiredIds = ((await mineExpired.json()) as { items: Array<{ id: string }> }).items.map((i) => i.id);
    expect(expiredIds).not.toContain(room.id);

    const resumeGone = await fetch(`${baseUrl}/v1/chats/${room.id}/resume`, {
      method: "POST",
      headers: authA,
    });
    expect(resumeGone.status).toBe(410);
  });
});
