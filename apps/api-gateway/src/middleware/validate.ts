import type { Context, Next } from "koa";
import type { ZodSchema } from "zod";

declare module "koa" {
  interface DefaultState {
    body?: unknown;
    query?: unknown;
    params?: unknown;
    chatJoin?: { roomId: string; memberId: string };
  }
}

export function validateBody<T>(schema: ZodSchema<T>) {
  return async (ctx: Context, next: Next) => {
    const parsed = schema.safeParse(ctx.request.body ?? {});
    if (!parsed.success) throw parsed.error;
    ctx.state.body = parsed.data;
    await next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return async (ctx: Context, next: Next) => {
    const parsed = schema.safeParse(ctx.query ?? {});
    if (!parsed.success) throw parsed.error;
    ctx.state.query = parsed.data;
    await next();
  };
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return async (ctx: Context, next: Next) => {
    const parsed = schema.safeParse(ctx.params ?? {});
    if (!parsed.success) throw parsed.error;
    ctx.state.params = parsed.data;
    await next();
  };
}
