import Router from "@koa/router";
import type { Context } from "koa";
import db from "../db.js";

export const transparencyRouter = new Router({ prefix: "/public" });

// ─── Public Transparency Stats (no auth) ───────────────────────────────────

transparencyRouter.get("/transparency", async (ctx: Context) => {
  const from = String(ctx.query.from ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());
  const to = String(ctx.query.to ?? new Date().toISOString());

  const totalReports = (db.prepare("SELECT count(*) as c FROM secret_reports WHERE created_at BETWEEN ? AND ?").get(from, to) as any).c;
  const actioned = (db.prepare("SELECT count(*) as c FROM secret_reports WHERE status = 'actioned' AND created_at BETWEEN ? AND ?").get(from, to) as any).c;
  const dismissed = (db.prepare("SELECT count(*) as c FROM secret_reports WHERE action_type = 'dismiss' AND created_at BETWEEN ? AND ?").get(from, to) as any).c;
  const pending = (db.prepare("SELECT count(*) as c FROM secret_reports WHERE status = 'open' AND created_at BETWEEN ? AND ?").get(from, to) as any).c;
  const contentRemoved = (db.prepare("SELECT count(*) as c FROM audit_log WHERE action = 'content_removed' AND created_at BETWEEN ? AND ?").get(from, to) as any).c;
  const warningsIssued = (db.prepare("SELECT count(*) as c FROM audit_log WHERE action = 'user_warned' AND created_at BETWEEN ? AND ?").get(from, to) as any).c;
  const accountsSuspended = (db.prepare("SELECT count(*) as c FROM audit_log WHERE action = 'user_suspended' AND created_at BETWEEN ? AND ?").get(from, to) as any).c;
  const accountsBanned = (db.prepare("SELECT count(*) as c FROM audit_log WHERE action = 'user_banned' AND created_at BETWEEN ? AND ?").get(from, to) as any).c;
  const appealsReceived = (db.prepare("SELECT count(*) as c FROM appeals WHERE created_at BETWEEN ? AND ?").get(from, to) as any).c;
  const appealsAccepted = (db.prepare("SELECT count(*) as c FROM appeals WHERE status = 'reversed' AND created_at BETWEEN ? AND ?").get(from, to) as any).c;
  const appealsRejected = (db.prepare("SELECT count(*) as c FROM appeals WHERE status = 'upheld' AND created_at BETWEEN ? AND ?").get(from, to) as any).c;

  ctx.body = {
    totalReports,
    actioned,
    dismissed,
    pending,
    contentRemoved,
    warningsIssued,
    accountsSuspended,
    accountsBanned,
    appealsReceived,
    appealsAccepted,
    appealsRejected,
  };
});
