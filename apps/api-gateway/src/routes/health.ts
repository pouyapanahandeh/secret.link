import Router from "@koa/router";
import db from "../db.js";

export const healthRouter = new Router();

healthRouter.get("/health", async (ctx) => {
  let dbOk = false;
  try {
    db.prepare("SELECT 1").get();
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const ok = dbOk;
  ctx.status = ok ? 200 : 503;
  ctx.set("Cache-Control", "no-store");
  ctx.body = {
    status: ok ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    checks: {
      db: dbOk ? "ok" : "error",
    },
  };
});
