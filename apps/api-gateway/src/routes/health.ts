import Router from "@koa/router";

export const healthRouter = new Router();

healthRouter.get("/health", async (ctx) => {
  ctx.status = 200;
  ctx.body = { status: "ok", timestamp: new Date().toISOString() };
});
