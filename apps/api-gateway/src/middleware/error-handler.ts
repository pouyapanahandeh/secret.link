import type { Context, Next } from "koa";
import { ZodError } from "zod";
import { logger } from "./logger.js";
import { captureException } from "../lib/sentry.js";

export function errorHandler() {
  return async (ctx: Context, next: Next) => {
    try {
      await next();
    } catch (err) {
      if (err instanceof ZodError) {
        ctx.status = 400;
        ctx.body = { error: "validation_error", issues: err.issues };
        return;
      }

      logger.error({ err, path: ctx.path }, "Unhandled error");
      captureException(err, { path: ctx.path, method: ctx.method });
      ctx.status = 500;
      ctx.body = { error: "internal_error" };
    }
  };
}
