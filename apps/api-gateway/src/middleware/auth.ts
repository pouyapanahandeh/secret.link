import type { Context, Next } from "koa";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev-secret-change-in-production";

if (process.env["NODE_ENV"] === "production" && (!process.env["JWT_SECRET"] || process.env["JWT_SECRET"] === "dev-secret-change-in-production")) {
  throw new Error("JWT_SECRET must be set to a secure value in production");
}

export interface AuthPayload {
  userId: string;
  handle: string;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

/** Middleware that requires a valid JWT in Authorization header or cookie */
export function requireAuth() {
  return async (ctx: Context, next: Next) => {
    const authHeader = ctx.get("Authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : (ctx.cookies.get("sl_token") ?? null);

    if (!token) {
      ctx.status = 401;
      ctx.body = { error: "unauthorized" };
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      ctx.status = 401;
      ctx.body = { error: "invalid_token" };
      return;
    }

    ctx.state.user = payload;
    await next();
  };
}
