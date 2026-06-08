import type { Context, Next } from "koa";
import pino from "pino";

const logger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  transport: process.env["NODE_ENV"] === "development" ? { target: "pino-pretty" } : undefined,
});

export function pinoLogger() {
  return async (ctx: Context, next: Next) => {
    const start = Date.now();
    ctx.state.logger = logger;

    await next();

    const ms = Date.now() - start;
    logger.info({
      method: ctx.method,
      path: ctx.path,
      status: ctx.status,
      ms,
    });
  };
}

export { logger };
