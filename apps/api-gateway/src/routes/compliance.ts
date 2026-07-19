import Router from "@koa/router";
import type { Context } from "koa";
import { nanoid } from "nanoid";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const complianceRouter = new Router({ prefix: "/users/me" });

complianceRouter.use(requireAuth());

// ─── Data Export (GDPR Art. 15 + 20) ────────────────────────────────────────

complianceRouter.get("/data-export", async (ctx: Context) => {
  const user = ctx.state.user;
  const userId = user.userId;

  const profile = db.prepare("SELECT id, handle, email, bio, avatar_url, socials, created_at FROM users WHERE id = ?").get(userId);
  const secrets = db.prepare("SELECT id, lat, lng, emoji, created_at, expires_at, location_name, city_name, CASE WHEN ciphertext IS NOT NULL AND ciphertext != '' THEN 1 ELSE 0 END AS encrypted FROM map_secrets WHERE handle = (SELECT handle FROM users WHERE id = ?)").all(userId);
  const sentSecrets = db.prepare("SELECT id, content_type, recipient_handle, created_at FROM secrets WHERE sender_id = ?").all(userId);
  const conversations = db.prepare(`
    SELECT c.id, c.participant1_handle, c.participant2_handle, c.created_at, c.last_message_at
    FROM conversations c
    WHERE c.participant1_id = ? OR c.participant2_id = ?
  `).all(userId, userId);
  const messages = db.prepare(`
    SELECT dm.id, dm.conversation_id, dm.sender_handle, dm.created_at
    FROM dm_messages dm
    WHERE dm.sender_id = ?
  `).all(userId);
  const follows = {
    following: db.prepare("SELECT u.handle, f.created_at FROM follows f JOIN users u ON f.following_id = u.id WHERE f.follower_id = ?").all(userId),
    followers: db.prepare("SELECT u.handle, f.created_at FROM follows f JOIN users u ON f.follower_id = u.id WHERE f.following_id = ?").all(userId),
  };
  const notifications = db.prepare("SELECT type, actor_handle, data, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").all(userId);
  const reports = db.prepare("SELECT id, secret_id, reason, details, status, created_at FROM secret_reports WHERE reporter_user_id = ?").all(userId);

  ctx.set("Content-Disposition", `attachment; filename="secretlink-data-${user.handle}.json"`);
  ctx.type = "application/json";
  ctx.body = {
    exported_at: new Date().toISOString(),
    profile,
    map_secrets: secrets,
    sent_secrets: sentSecrets,
    conversations,
    messages_sent: messages,
    follows,
    notifications,
    reports_filed: reports,
  };
});

// ─── Account Deletion (GDPR Art. 17) ────────────────────────────────────────

complianceRouter.post("/request-deletion", async (ctx: Context) => {
  const user = ctx.state.user;
  const userId = user.userId;

  // Check if already pending
  const existing = db.prepare("SELECT id FROM deletion_requests WHERE user_id = ? AND status = 'pending'").get(userId) as any;
  if (existing) {
    ctx.body = { ok: true, message: "Deletion already requested. Will be executed in 7 days.", id: existing.id };
    return;
  }

  const now = new Date();
  const executeAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days grace
  const id = nanoid();

  db.prepare("INSERT INTO deletion_requests (id, user_id, requested_at, execute_at, status) VALUES (?, ?, ?, ?, 'pending')")
    .run(id, userId, now.toISOString(), executeAt.toISOString());

  ctx.body = {
    ok: true,
    message: "Account deletion scheduled. You have 7 days to cancel. After that, all your data will be permanently deleted.",
    execute_at: executeAt.toISOString(),
    id,
  };
});

complianceRouter.post("/cancel-deletion", async (ctx: Context) => {
  const user = ctx.state.user;
  const result = db.prepare("UPDATE deletion_requests SET status = 'cancelled' WHERE user_id = ? AND status = 'pending'").run(user.userId);

  if (result.changes === 0) {
    ctx.status = 404;
    ctx.body = { error: "no_pending_deletion" };
    return;
  }

  ctx.body = { ok: true, message: "Deletion request cancelled." };
});

// ─── Appeals (DSA) ──────────────────────────────────────────────────────────

complianceRouter.post("/appeals", async (ctx: Context) => {
  const user = ctx.state.user;
  const body = ctx.request.body as Record<string, unknown>;
  const { report_id, reason } = body;

  if (!report_id || !reason) {
    ctx.status = 400;
    ctx.body = { error: "missing_fields", message: "report_id and reason are required" };
    return;
  }

  // Verify the report exists and is actioned against this user's content
  const report = db.prepare(`
    SELECT sr.id FROM secret_reports sr
    JOIN map_secrets ms ON sr.secret_id = ms.id
    WHERE sr.id = ? AND ms.handle = (SELECT handle FROM users WHERE id = ?) AND sr.status = 'actioned'
  `).get(report_id, user.userId) as any;

  if (!report) {
    ctx.status = 404;
    ctx.body = { error: "not_found", message: "No actioned report found for your content" };
    return;
  }

  // Check if already appealed
  const existing = db.prepare("SELECT id FROM appeals WHERE report_id = ? AND user_id = ?").get(report_id, user.userId) as any;
  if (existing) {
    ctx.status = 409;
    ctx.body = { error: "already_appealed", message: "You have already appealed this decision" };
    return;
  }

  const id = nanoid();
  db.prepare("INSERT INTO appeals (id, report_id, user_id, reason, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)")
    .run(id, report_id, user.userId, reason, new Date().toISOString());

  db.prepare("UPDATE secret_reports SET appeal_status = 'pending' WHERE id = ?").run(report_id);

  ctx.body = { ok: true, id, message: "Appeal submitted. You will be notified of the decision." };
});

complianceRouter.get("/appeals", async (ctx: Context) => {
  const user = ctx.state.user;
  const appeals = db.prepare(`
    SELECT a.*, sr.reason as report_reason, sr.action_type, sr.action_reason
    FROM appeals a
    JOIN secret_reports sr ON a.report_id = sr.id
    WHERE a.user_id = ?
    ORDER BY a.created_at DESC
  `).all(user.userId);

  ctx.body = appeals;
});
