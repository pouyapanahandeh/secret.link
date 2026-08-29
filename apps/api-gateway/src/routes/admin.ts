import Router from "@koa/router";
import type { Context } from "koa";
import { nanoid } from "nanoid";
import db from "../db.js";
import { requireAuth, clearSuspensionCache } from "../middleware/auth.js";
import { requireAdmin, requireSuperAdmin } from "../middleware/admin.js";
import { runSystemStatusChecks } from "../lib/status-checks.js";

export const adminRouter = new Router({ prefix: "/admin" });

// All admin routes require auth + admin role
adminRouter.use(requireAuth());
adminRouter.use(requireAdmin());

// ─── Helpers ────────────────────────────────────────────────────────────────

function logAudit(actorId: string, actorHandle: string, action: string, targetType: string, targetId: string | null, details?: string) {
  db.prepare(
    `INSERT INTO audit_log (id, actor_id, actor_handle, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(nanoid(), actorId, actorHandle, action, targetType, targetId, details ?? null, new Date().toISOString());
}

// ─── Dashboard Stats ────────────────────────────────────────────────────────

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function fillDaySeries(rows: { day: string; c: number }[], days: string[]) {
  const map = new Map(rows.map((row) => [row.day, Number(row.c)]));
  return days.map((day) => ({ day, count: map.get(day) ?? 0 }));
}

adminRouter.get("/stats", async (ctx: Context) => {
  const nowIso = new Date().toISOString();
  const days = lastNDays(14);
  const since = days[0];

  const userSeries = fillDaySeries(
    db.prepare(`SELECT substr(created_at, 1, 10) as day, count(*) as c FROM users WHERE created_at >= ? GROUP BY day`).all(since) as { day: string; c: number }[],
    days,
  );
  const reportSeries = fillDaySeries(
    db.prepare(`SELECT substr(created_at, 1, 10) as day, count(*) as c FROM secret_reports WHERE created_at >= ? GROUP BY day`).all(since) as { day: string; c: number }[],
    days,
  );
  const secretSeries = fillDaySeries(
    db.prepare(`SELECT substr(created_at, 1, 10) as day, count(*) as c FROM map_secrets WHERE created_at >= ? GROUP BY day`).all(since) as { day: string; c: number }[],
    days,
  );

  const stats = {
    users: (db.prepare("SELECT count(*) as c FROM users").get() as any).c,
    openReports: (db.prepare("SELECT count(*) as c FROM secret_reports WHERE status = 'open'").get() as any).c,
    totalReports: (db.prepare("SELECT count(*) as c FROM secret_reports").get() as any).c,
    activeSecrets: (db.prepare("SELECT count(*) as c FROM map_secrets WHERE expires_at > ?").get(nowIso) as any).c,
    pendingAppeals: (db.prepare("SELECT count(*) as c FROM appeals WHERE status = 'pending'").get() as any).c,
    suspendedUsers: (db.prepare("SELECT count(*) as c FROM user_suspensions WHERE lifted_at IS NULL AND (expires_at IS NULL OR expires_at > ?)").get(nowIso) as any).c,
    pendingDeletions: (db.prepare("SELECT count(*) as c FROM deletion_requests WHERE status = 'pending'").get() as any).c,
    newContactMessages: (db.prepare("SELECT count(*) as c FROM contact_messages WHERE status = 'new'").get() as any).c,
    series: {
      users: userSeries,
      reports: reportSeries,
      secrets: secretSeries,
    },
    reportsByStatus: db.prepare("SELECT status, count(*) as count FROM secret_reports GROUP BY status").all(),
    reportsByReason: db.prepare("SELECT reason, count(*) as count FROM secret_reports GROUP BY reason ORDER BY count DESC LIMIT 8").all(),
    usersByRole: db.prepare("SELECT COALESCE(role, 'user') as role, count(*) as count FROM users GROUP BY role").all(),
  };
  ctx.body = stats;
});

// ─── System status (super admin only) ───────────────────────────────────────

adminRouter.get("/status", requireSuperAdmin(), async (ctx: Context) => {
  ctx.set("Cache-Control", "no-store");
  ctx.body = await runSystemStatusChecks();
});

// ─── Contact Messages ───────────────────────────────────────────────────────

adminRouter.get("/contact-messages", async (ctx: Context) => {
  const status = String(ctx.query.status ?? "new");
  const limit = Math.min(Number(ctx.query.limit) || 50, 100);
  const offset = Number(ctx.query.offset) || 0;

  const messages = db.prepare(`
    SELECT cm.*,
           u.handle as user_handle,
           u.role as user_role,
           u.created_at as user_created_at,
           u.email as user_email,
           u.avatar_url as user_avatar_url
    FROM contact_messages cm
    LEFT JOIN users u ON cm.user_id = u.id
    WHERE cm.status = ?
    ORDER BY cm.created_at DESC
    LIMIT ? OFFSET ?
  `).all(status, limit, offset);

  const total = (db.prepare("SELECT count(*) as c FROM contact_messages WHERE status = ?").get(status) as any).c;
  const countRows = db.prepare("SELECT status, count(*) as count FROM contact_messages GROUP BY status").all() as { status: string; count: number }[];
  const counts = { new: 0, read: 0, archived: 0, ...Object.fromEntries(countRows.map((row) => [row.status, row.count])) };

  ctx.body = { messages, total, counts, limit, offset };
});

adminRouter.patch("/contact-messages/:id", async (ctx: Context) => {
  const body = ctx.request.body as Record<string, unknown>;
  const status = body.status;

  if (!status || !["new", "read", "archived"].includes(status as string)) {
    ctx.status = 400;
    ctx.body = { error: "invalid_status", message: "status must be: new, read, or archived" };
    return;
  }

  const message = db.prepare("SELECT id FROM contact_messages WHERE id = ?").get(ctx.params.id);
  if (!message) { ctx.status = 404; ctx.body = { error: "not_found" }; return; }

  db.prepare("UPDATE contact_messages SET status = ? WHERE id = ?").run(status, ctx.params.id);
  ctx.body = { ok: true };
});

// ─── Reports ────────────────────────────────────────────────────────────────

adminRouter.get("/reports", async (ctx: Context) => {
  const status = String(ctx.query.status ?? "open");
  const limit = Math.min(Number(ctx.query.limit) || 50, 100);
  const offset = Number(ctx.query.offset) || 0;

  const reports = db.prepare(`
    SELECT sr.*, ms.emoji, ms.handle as secret_handle, ms.lat, ms.lng,
           CASE WHEN ms.ciphertext IS NOT NULL AND ms.ciphertext != '' THEN 1 ELSE 0 END as secret_encrypted,
           u.handle as reporter_handle
    FROM secret_reports sr
    LEFT JOIN map_secrets ms ON sr.secret_id = ms.id
    LEFT JOIN users u ON sr.reporter_user_id = u.id
    WHERE sr.status = ?
    ORDER BY sr.created_at DESC
    LIMIT ? OFFSET ?
  `).all(status, limit, offset);

  const total = (db.prepare("SELECT count(*) as c FROM secret_reports WHERE status = ?").get(status) as any).c;

  ctx.body = { reports, total, limit, offset };
});

adminRouter.get("/reports/:id", async (ctx: Context) => {
  const report = db.prepare(`
    SELECT sr.*, ms.emoji, ms.handle as secret_handle, ms.lat, ms.lng,
           CASE WHEN ms.ciphertext IS NOT NULL AND ms.ciphertext != '' THEN 1 ELSE 0 END as secret_encrypted,
           ms.location_name, ms.city_name, ms.created_at as secret_created_at, ms.expires_at as secret_expires_at,
           u.handle as reporter_handle
    FROM secret_reports sr
    LEFT JOIN map_secrets ms ON sr.secret_id = ms.id
    LEFT JOIN users u ON sr.reporter_user_id = u.id
    WHERE sr.id = ?
  `).get(ctx.params.id);

  if (!report) { ctx.status = 404; ctx.body = { error: "not_found" }; return; }
  ctx.body = report;
});

adminRouter.patch("/reports/:id", async (ctx: Context) => {
  const body = ctx.request.body as Record<string, unknown>;
  const { action_type, action_reason, internal_notes } = body;
  const user = ctx.state.user;

  if (!action_type || !["remove", "warn", "ban", "dismiss"].includes(action_type as string)) {
    ctx.status = 400;
    ctx.body = { error: "invalid_action", message: "action_type must be: remove, warn, ban, or dismiss" };
    return;
  }

  const report = db.prepare("SELECT * FROM secret_reports WHERE id = ?").get(ctx.params.id) as any;
  if (!report) { ctx.status = 404; ctx.body = { error: "not_found" }; return; }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE secret_reports SET status = 'actioned', actioned_by = ?, actioned_at = ?, action_type = ?, action_reason = ?, internal_notes = ?
    WHERE id = ?
  `).run(user.userId, now, action_type, action_reason ?? null, internal_notes ?? null, ctx.params.id);

  // Execute the action
  if (action_type === "remove") {
    // Read the owner handle BEFORE deleting the row (otherwise the notification
    // lookup below finds nothing and the owner is never told).
    const secret = db.prepare("SELECT handle FROM map_secrets WHERE id = ?").get(report.secret_id) as any;
    db.prepare("DELETE FROM map_secrets WHERE id = ?").run(report.secret_id);
    logAudit(user.userId, user.handle, "content_removed", "map_secret", report.secret_id, action_reason as string);

    // Notify the content owner
    if (secret?.handle) {
      const owner = db.prepare("SELECT id FROM users WHERE handle = ?").get(secret.handle) as any;
      if (owner) {
        db.prepare(`INSERT INTO notifications (id, user_id, type, actor_handle, entity_id, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(nanoid(), owner.id, "content_removed", "moderation", report.secret_id, JSON.stringify({ reason: action_reason }), now);
      }
    }
  } else if (action_type === "warn") {
    const secret = db.prepare("SELECT handle FROM map_secrets WHERE id = ?").get(report.secret_id) as any;
    if (secret?.handle) {
      const owner = db.prepare("SELECT id FROM users WHERE handle = ?").get(secret.handle) as any;
      if (owner) {
        db.prepare(`INSERT INTO notifications (id, user_id, type, actor_handle, entity_id, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(nanoid(), owner.id, "warning_issued", "moderation", report.secret_id, JSON.stringify({ reason: action_reason }), now);
      }
    }
    logAudit(user.userId, user.handle, "user_warned", "user", null, action_reason as string);
  } else if (action_type === "ban") {
    const secret = db.prepare("SELECT handle FROM map_secrets WHERE id = ?").get(report.secret_id) as any;
    if (secret?.handle) {
      const owner = db.prepare("SELECT id FROM users WHERE handle = ?").get(secret.handle) as any;
      if (owner) {
        db.prepare(`INSERT INTO user_suspensions (id, user_id, reason, suspended_by, suspended_at) VALUES (?, ?, ?, ?, ?)`)
          .run(nanoid(), owner.id, (action_reason as string) ?? "Policy violation", user.userId, now);
        clearSuspensionCache(owner.id);
        db.prepare(`INSERT INTO notifications (id, user_id, type, actor_handle, entity_id, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(nanoid(), owner.id, "account_suspended", "moderation", null, JSON.stringify({ reason: action_reason }), now);
      }
    }
    // Also remove the content
    db.prepare("DELETE FROM map_secrets WHERE id = ?").run(report.secret_id);
    logAudit(user.userId, user.handle, "user_banned", "user", null, action_reason as string);
  } else {
    logAudit(user.userId, user.handle, "report_dismissed", "report", ctx.params.id, action_reason as string);
  }

  // Notify reporter that their report was reviewed
  if (report.reporter_user_id) {
    db.prepare(`INSERT INTO notifications (id, user_id, type, actor_handle, entity_id, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(nanoid(), report.reporter_user_id, "report_reviewed", "moderation", ctx.params.id, JSON.stringify({ action: action_type }), now);
  }

  ctx.body = { ok: true, action_type };
});

// ─── Users Management ───────────────────────────────────────────────────────

adminRouter.get("/users", async (ctx: Context) => {
  const search = String(ctx.query.search ?? "");
  const limit = Math.min(Number(ctx.query.limit) || 50, 100);
  const offset = Number(ctx.query.offset) || 0;

  let users;
  let total;
  if (search) {
    users = db.prepare(`SELECT id, handle, email, role, bio, avatar_url, created_at FROM users WHERE handle LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(`%${search}%`, limit, offset);
    total = (db.prepare("SELECT count(*) as c FROM users WHERE handle LIKE ?").get(`%${search}%`) as any).c;
  } else {
    users = db.prepare(`SELECT id, handle, email, role, bio, avatar_url, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(limit, offset);
    total = (db.prepare("SELECT count(*) as c FROM users").get() as any).c;
  }

  // Add suspension status
  const enriched = users.map((u: any) => {
    const suspension = db.prepare("SELECT id, reason, suspended_at, expires_at FROM user_suspensions WHERE user_id = ? AND lifted_at IS NULL ORDER BY suspended_at DESC LIMIT 1").get(u.id) as any;
    return { ...u, suspended: !!suspension, suspension: suspension ?? null };
  });

  ctx.body = { users: enriched, total, limit, offset };
});

adminRouter.get("/users/:id", async (ctx: Context) => {
  const user = db.prepare("SELECT id, handle, email, role, bio, avatar_url, socials, created_at FROM users WHERE id = ?").get(ctx.params.id) as any;
  if (!user) { ctx.status = 404; ctx.body = { error: "not_found" }; return; }

  const secrets = db.prepare("SELECT count(*) as c FROM map_secrets WHERE handle = ?").get(user.handle) as any;
  const reports = db.prepare("SELECT count(*) as c FROM secret_reports WHERE reporter_user_id = ?").get(user.id) as any;
  const reportsAgainst = db.prepare(`
    SELECT count(*) as c FROM secret_reports sr
    JOIN map_secrets ms ON sr.secret_id = ms.id
    WHERE ms.handle = ?
  `).get(user.handle) as any;
  const suspensions = db.prepare("SELECT * FROM user_suspensions WHERE user_id = ? ORDER BY suspended_at DESC").all(user.id);
  const currentSuspension = db.prepare("SELECT * FROM user_suspensions WHERE user_id = ? AND lifted_at IS NULL ORDER BY suspended_at DESC LIMIT 1").get(user.id);

  ctx.body = {
    ...user,
    stats: {
      secrets: secrets.c,
      reportsFiled: reports.c,
      reportsAgainst: reportsAgainst.c,
    },
    suspensions,
    currentSuspension,
  };
});

adminRouter.patch("/users/:id", async (ctx: Context) => {
  const body = ctx.request.body as Record<string, unknown>;
  const admin = ctx.state.user;
  const targetUser = db.prepare("SELECT id, handle, role FROM users WHERE id = ?").get(ctx.params.id) as any;
  if (!targetUser) { ctx.status = 404; ctx.body = { error: "not_found" }; return; }

  // Role change (super admin only)
  if (body.role !== undefined) {
    if (ctx.state.role !== "admin") {
      ctx.status = 403; ctx.body = { error: "forbidden", message: "Only admins can change roles" }; return;
    }
    if (!["user", "moderator", "admin", "editor"].includes(body.role as string)) {
      ctx.status = 400; ctx.body = { error: "invalid_role" }; return;
    }
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(body.role, ctx.params.id);
    logAudit(admin.userId, admin.handle, "role_changed", "user", ctx.params.id, `${targetUser.role} → ${body.role}`);
  }

  // Suspend
  if (body.suspend === true) {
    const reason = String(body.reason ?? "Policy violation");
    const expiresAt = body.expires_at ? String(body.expires_at) : null;
    db.prepare(`INSERT INTO user_suspensions (id, user_id, reason, suspended_by, suspended_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(nanoid(), ctx.params.id, reason, admin.userId, new Date().toISOString(), expiresAt);
    clearSuspensionCache(ctx.params.id);
    db.prepare(`INSERT INTO notifications (id, user_id, type, actor_handle, entity_id, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(nanoid(), ctx.params.id, "account_suspended", "moderation", null, JSON.stringify({ reason }), new Date().toISOString());
    logAudit(admin.userId, admin.handle, "user_suspended", "user", ctx.params.id, reason);
  }

  // Unsuspend
  if (body.unsuspend === true) {
    db.prepare("UPDATE user_suspensions SET lifted_at = ? WHERE user_id = ? AND lifted_at IS NULL")
      .run(new Date().toISOString(), ctx.params.id);
    clearSuspensionCache(ctx.params.id);
    db.prepare(`INSERT INTO notifications (id, user_id, type, actor_handle, entity_id, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(nanoid(), ctx.params.id, "suspension_lifted", "moderation", null, null, new Date().toISOString());
    logAudit(admin.userId, admin.handle, "user_unsuspended", "user", ctx.params.id, undefined);
  }

  ctx.body = { ok: true };
});

// Delete user content
adminRouter.delete("/users/:userId/content/:contentId", async (ctx: Context) => {
  const admin = ctx.state.user;
  const { userId, contentId } = ctx.params;

  const secret = db.prepare("SELECT * FROM map_secrets WHERE id = ?").get(contentId) as any;
  if (!secret) { ctx.status = 404; ctx.body = { error: "not_found" }; return; }

  db.prepare("DELETE FROM map_secrets WHERE id = ?").run(contentId);
  logAudit(admin.userId, admin.handle, "content_removed", "map_secret", contentId, `Removed from user ${userId}`);

  // Notify user
  const targetUser = db.prepare("SELECT id FROM users WHERE id = ?").get(userId) as any;
  if (targetUser) {
    db.prepare(`INSERT INTO notifications (id, user_id, type, actor_handle, entity_id, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(nanoid(), userId, "content_removed", "moderation", contentId, JSON.stringify({ reason: "Removed by moderator" }), new Date().toISOString());
  }

  ctx.body = { ok: true };
});

// ─── Appeals ────────────────────────────────────────────────────────────────

adminRouter.get("/appeals", async (ctx: Context) => {
  const status = String(ctx.query.status ?? "pending");
  const limit = Math.min(Number(ctx.query.limit) || 50, 100);
  const offset = Number(ctx.query.offset) || 0;

  const appeals = db.prepare(`
    SELECT a.*, u.handle as user_handle, sr.reason as report_reason, sr.action_type
    FROM appeals a
    JOIN users u ON a.user_id = u.id
    JOIN secret_reports sr ON a.report_id = sr.id
    WHERE a.status = ?
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(status, limit, offset);

  const total = (db.prepare("SELECT count(*) as c FROM appeals WHERE status = ?").get(status) as any).c;
  ctx.body = { appeals, total, limit, offset };
});

adminRouter.patch("/appeals/:id", async (ctx: Context) => {
  const body = ctx.request.body as Record<string, unknown>;
  const admin = ctx.state.user;
  const { decision, resolution_note } = body;

  if (!decision || !["upheld", "reversed"].includes(decision as string)) {
    ctx.status = 400;
    ctx.body = { error: "invalid_decision", message: "decision must be: upheld or reversed" };
    return;
  }

  const appeal = db.prepare("SELECT * FROM appeals WHERE id = ?").get(ctx.params.id) as any;
  if (!appeal) { ctx.status = 404; ctx.body = { error: "not_found" }; return; }

  const now = new Date().toISOString();
  db.prepare("UPDATE appeals SET status = ?, reviewed_by = ?, reviewed_at = ?, resolution_note = ? WHERE id = ?")
    .run(decision, admin.userId, now, resolution_note ?? null, ctx.params.id);

  // Update report appeal_status
  db.prepare("UPDATE secret_reports SET appeal_status = ? WHERE id = ?")
    .run(decision, appeal.report_id);

  // If reversed, lift any suspension
  if (decision === "reversed") {
    db.prepare("UPDATE user_suspensions SET lifted_at = ? WHERE user_id = ? AND lifted_at IS NULL")
      .run(now, appeal.user_id);
    clearSuspensionCache(appeal.user_id);
  }

  // Notify the user
  db.prepare(`INSERT INTO notifications (id, user_id, type, actor_handle, entity_id, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(nanoid(), appeal.user_id, "appeal_resolved", "moderation", ctx.params.id, JSON.stringify({ decision, note: resolution_note }), now);

  logAudit(admin.userId, admin.handle, `appeal_${decision}`, "appeal", ctx.params.id, resolution_note as string);
  ctx.body = { ok: true, decision };
});

// ─── Audit Log ──────────────────────────────────────────────────────────────

adminRouter.get("/audit", async (ctx: Context) => {
  const limit = Math.min(Number(ctx.query.limit) || 50, 100);
  const offset = Number(ctx.query.offset) || 0;
  const actor = ctx.query.actor ? String(ctx.query.actor) : null;

  let logs;
  let total;
  if (actor) {
    logs = db.prepare("SELECT * FROM audit_log WHERE actor_handle LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
      .all(`%${actor}%`, limit, offset);
    total = (db.prepare("SELECT count(*) as c FROM audit_log WHERE actor_handle LIKE ?").get(`%${actor}%`) as any).c;
  } else {
    logs = db.prepare("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?")
      .all(limit, offset);
    total = (db.prepare("SELECT count(*) as c FROM audit_log").get() as any).c;
  }

  ctx.body = { logs, total, limit, offset };
});

// ─── Transparency Stats (for Phase 3) ──────────────────────────────────────

adminRouter.get("/transparency", async (ctx: Context) => {
  const from = String(ctx.query.from ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());
  const to = String(ctx.query.to ?? new Date().toISOString());

  const stats = {
    period: { from, to },
    reports: {
      total: (db.prepare("SELECT count(*) as c FROM secret_reports WHERE created_at BETWEEN ? AND ?").get(from, to) as any).c,
      byReason: db.prepare("SELECT reason, count(*) as count FROM secret_reports WHERE created_at BETWEEN ? AND ? GROUP BY reason ORDER BY count DESC").all(from, to),
      actioned: (db.prepare("SELECT count(*) as c FROM secret_reports WHERE status = 'actioned' AND created_at BETWEEN ? AND ?").get(from, to) as any).c,
      dismissed: (db.prepare("SELECT count(*) as c FROM secret_reports WHERE action_type = 'dismiss' AND created_at BETWEEN ? AND ?").get(from, to) as any).c,
    },
    actions: {
      removals: (db.prepare("SELECT count(*) as c FROM audit_log WHERE action = 'content_removed' AND created_at BETWEEN ? AND ?").get(from, to) as any).c,
      warnings: (db.prepare("SELECT count(*) as c FROM audit_log WHERE action = 'user_warned' AND created_at BETWEEN ? AND ?").get(from, to) as any).c,
      suspensions: (db.prepare("SELECT count(*) as c FROM audit_log WHERE action = 'user_suspended' AND created_at BETWEEN ? AND ?").get(from, to) as any).c,
      bans: (db.prepare("SELECT count(*) as c FROM audit_log WHERE action = 'user_banned' AND created_at BETWEEN ? AND ?").get(from, to) as any).c,
    },
    appeals: {
      total: (db.prepare("SELECT count(*) as c FROM appeals WHERE created_at BETWEEN ? AND ?").get(from, to) as any).c,
      upheld: (db.prepare("SELECT count(*) as c FROM appeals WHERE status = 'upheld' AND created_at BETWEEN ? AND ?").get(from, to) as any).c,
      reversed: (db.prepare("SELECT count(*) as c FROM appeals WHERE status = 'reversed' AND created_at BETWEEN ? AND ?").get(from, to) as any).c,
    },
  };

  ctx.body = stats;
});
