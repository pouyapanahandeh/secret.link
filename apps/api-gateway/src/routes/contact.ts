import Router from "@koa/router";
import type { Context } from "koa";
import { nanoid } from "nanoid";
import db from "../db.js";

export const contactRouter = new Router({ prefix: "/public" });

const insertMessage = db.prepare(`
  INSERT INTO contact_messages (id, name, email, message, user_id, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

// ─── Public contact form submission (no auth required) ─────────────────────

contactRouter.post("/contact", async (ctx: Context) => {
  const body = (ctx.request.body ?? {}) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : null;
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 254) : null;
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (message.length < 10 || message.length > 5000) {
    ctx.status = 400;
    ctx.body = { error: "invalid_message", message: "Message must be between 10 and 5000 characters" };
    return;
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    ctx.status = 400;
    ctx.body = { error: "invalid_email", message: "Invalid email address" };
    return;
  }

  // If the sender happens to be logged in, link the message to their account.
  const userId = (ctx.state.user?.userId as string | undefined) ?? null;

  insertMessage.run(nanoid(), name || null, email || null, message, userId, new Date().toISOString());

  ctx.status = 201;
  ctx.body = { ok: true };
});
