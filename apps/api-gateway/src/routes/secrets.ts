import Router from "@koa/router";
import { createSecret, revealSecret } from "@secretlink/core";
import type { ContentType } from "@secretlink/core";
import { nanoid } from "nanoid";
import type { Context } from "koa";
import { promises as fs } from "node:fs";
import path from "node:path";
import db from "../db.js";

export const secretsRouter = new Router({ prefix: "/secrets" });

// Local blob storage directory
const BLOB_DIR = path.resolve(process.cwd(), ".blobs");
fs.mkdir(BLOB_DIR, { recursive: true }).catch(() => {});

// ─── SQLite-backed secret store ─────────────────────────────────────────────
const secretStmts = {
  insert: db.prepare(`INSERT INTO secrets (id, ciphertext, content_type, blob_path, blob_size_bytes, mime_type, nonce, view_duration_seconds, max_views, view_count, burned, recipient_handle, sender_id, workspace_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)`),
  findById: db.prepare(`SELECT * FROM secrets WHERE id = ?`),
  incrementView: db.prepare(`UPDATE secrets SET view_count = view_count + 1 WHERE id = ?`),
  burn: db.prepare(`UPDATE secrets SET burned = 1 WHERE id = ?`),
  inbox: db.prepare(`SELECT id, content_type, created_at, view_count, max_views, burned FROM secrets WHERE recipient_handle = ? AND burned = 0 ORDER BY created_at DESC`),
  sent: db.prepare(`SELECT id, content_type, recipient_handle, created_at, view_count, max_views, burned FROM secrets WHERE sender_id = ? ORDER BY created_at DESC`),
};

const mapStmts = {
  insert: db.prepare(`INSERT INTO map_secrets (id, message, lat, lng, emoji, handle, media_path, media_type, reveal_mode, reveal_timer_seconds, max_clicks, click_count, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`),
  getActive: db.prepare(`SELECT * FROM map_secrets WHERE expires_at > ?`),
  getById: db.prepare(`SELECT * FROM map_secrets WHERE id = ? AND expires_at > ?`),
  deleteExpired: db.prepare(`DELETE FROM map_secrets WHERE expires_at <= ?`),
  incrementClicks: db.prepare(`UPDATE map_secrets SET click_count = click_count + 1 WHERE id = ?`),
};

const deps = {
  repo: {
    save: async (record: any) => {
      secretStmts.insert.run(
        record.id, record.ciphertext, record.contentType,
        record.blobPath ?? null, record.blobSizeBytes ?? null,
        record.mimeType ?? null, record.nonce ?? null,
        record.viewDurationSeconds ?? null, record.maxViews,
        record.recipientHandle ?? null, record.senderId ?? null,
        record.workspaceId ?? null,
        record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
        record.expiresAt instanceof Date ? record.expiresAt.toISOString() : record.expiresAt,
      );
    },
    findById: async (id: string) => {
      const row = secretStmts.findById.get(id) as any;
      if (!row) return null;
      return {
        id: row.id,
        ciphertext: row.ciphertext,
        contentType: row.content_type as ContentType,
        blobPath: row.blob_path,
        blobSizeBytes: row.blob_size_bytes,
        mimeType: row.mime_type,
        nonce: row.nonce,
        viewDurationSeconds: row.view_duration_seconds,
        maxViews: row.max_views,
        viewCount: row.view_count,
        createdAt: new Date(row.created_at),
        expiresAt: new Date(row.expires_at),
        workspaceId: row.workspace_id,
        recipientHandle: row.recipient_handle,
        burned: !!row.burned,
      };
    },
    incrementViewCount: async (id: string) => {
      secretStmts.incrementView.run(id);
    },
    burn: async (id: string) => {
      const row = secretStmts.findById.get(id) as any;
      secretStmts.burn.run(id);
      if (row?.blob_path) {
        setTimeout(() => {
          fs.unlink(path.join(BLOB_DIR, row.blob_path)).catch(() => {});
        }, 60_000);
      }
    },
  },
  kms: { wrap: async (_dek: Uint8Array, _wsId?: string) => "wrapped-key" },
  clock: { now: () => new Date() },
  id: () => nanoid(),
};

secretsRouter.post("/", async (ctx: Context) => {
  const result = await createSecret(deps)(ctx.request.body);
  result.match(
    (val) => {
      ctx.status = 201;
      ctx.body = val;
    },
    (e) => {
      ctx.status = e.kind === "invalid_input" ? 400 : 500;
      ctx.body = { error: e.kind };
    },
  );
});

// ─── Map Secrets (must be before /:id to avoid conflicts) ───────────────────
secretsRouter.post("/map", async (ctx: Context) => {
  const body = ctx.request.body as Record<string, unknown>;
  const message = String(body.message ?? "").trim();
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const emoji = String(body.emoji ?? "💬").slice(0, 4);
  const handle = body.handle ? String(body.handle) : undefined;
  const ttlMinutes = Math.min(Math.max(Number(body.ttlMinutes) || 60, 5), 1440);

  if (!message || message.length > 500) {
    ctx.status = 400;
    ctx.body = { error: "Message required (max 500 chars)" };
    return;
  }
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    ctx.status = 400;
    ctx.body = { error: "Invalid coordinates" };
    return;
  }

  const id = nanoid();
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();

  const mediaPath = body.mediaPath ? String(body.mediaPath) : null;
  const mediaType = body.mediaType ? String(body.mediaType) : null;
  const revealMode = body.revealMode === "clicks" ? "clicks" : "timer";
  const revealTimerSeconds = Math.min(Math.max(Number(body.revealTimerSeconds) || 30, 5), 300);
  const maxClicks = revealMode === "clicks" ? Math.min(Math.max(Number(body.maxClicks) || 1, 1), 100) : 0;

  mapStmts.insert.run(id, message, lat, lng, emoji, handle ?? null, mediaPath, mediaType, revealMode, revealTimerSeconds, maxClicks, createdAt, expiresAt);

  ctx.status = 201;
  ctx.body = { id, message, lat, lng, emoji, handle, mediaPath, mediaType, revealMode, revealTimerSeconds, maxClicks, clickCount: 0, createdAt, expiresAt };
});

secretsRouter.get("/map", async (ctx: Context) => {
  // Clean up expired
  mapStmts.deleteExpired.run(new Date().toISOString());
  const rows = mapStmts.getActive.all(new Date().toISOString()) as any[];
  ctx.body = rows;
});

secretsRouter.get("/map/:id", async (ctx: Context) => {
  const id = ctx.params["id"];
  const row = mapStmts.getById.get(id!, new Date().toISOString()) as any;

  if (!row) {
    ctx.status = 404;
    ctx.body = { error: "Secret expired or not found" };
    return;
  }

  ctx.body = row;
});

secretsRouter.post("/map/:id/reveal", async (ctx: Context) => {
  const id = ctx.params["id"];
  const row = mapStmts.getById.get(id!, new Date().toISOString()) as any;

  if (!row) {
    ctx.status = 404;
    ctx.body = { error: "Secret expired or not found" };
    return;
  }

  if (row.reveal_mode === "clicks") {
    if (row.click_count >= row.max_clicks) {
      ctx.status = 403;
      ctx.body = { error: "limit_reached", message: `This secret has reached its reveal limit (${row.max_clicks}).` };
      return;
    }
    mapStmts.incrementClicks.run(id!);
    row.click_count += 1;
  }

  ctx.body = row;
});

secretsRouter.get("/:id", async (ctx: Context) => {
  const result = await revealSecret(deps)(ctx.params["id"]!);
  result.match(
    (val) => {
      ctx.status = 200;
      ctx.body = val;
    },
    (e) => {
      const statusMap = {
        not_found: 404,
        expired: 410,
        max_views_reached: 410,
        burned: 410,
        storage_error: 500,
      } as const;
      ctx.status = statusMap[e.kind];
      ctx.body = { error: e.kind };
    },
  );
});

// Upload encrypted blob (binary body)
// Client sends encrypted file data directly; returns the blob path
secretsRouter.post("/blob", async (ctx: Context) => {
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB

  // Read raw body
  const chunks: Buffer[] = [];
  let totalSize = 0;

  await new Promise<void>((resolve, reject) => {
    ctx.req.on("data", (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > MAX_SIZE) {
        reject(new Error("File too large"));
        return;
      }
      chunks.push(chunk);
    });
    ctx.req.on("end", resolve);
    ctx.req.on("error", reject);
  });

  const blobId = nanoid();
  const blobPath = `${blobId}.bin`;
  await fs.writeFile(path.join(BLOB_DIR, blobPath), Buffer.concat(chunks));

  ctx.status = 201;
  ctx.body = { blobPath, sizeBytes: totalSize };
});

// Download encrypted blob
secretsRouter.get("/blob/:path", async (ctx: Context) => {
  const blobPath = ctx.params["path"];
  if (!blobPath || blobPath.includes("..") || blobPath.includes("/")) {
    ctx.status = 400;
    ctx.body = { error: "invalid_path" };
    return;
  }

  const filePath = path.join(BLOB_DIR, blobPath);
  try {
    const data = await fs.readFile(filePath);
    ctx.status = 200;
    ctx.type = "application/octet-stream";
    ctx.body = data;
  } catch {
    ctx.status = 404;
    ctx.body = { error: "blob_not_found" };
  }
});

// ─── Inbox: Get secrets sent TO a handle ────────────────────────────────────
secretsRouter.get("/inbox/:handle", async (ctx: Context) => {
  const handle = ctx.params["handle"];
  const rows = secretStmts.inbox.all(handle!) as any[];
  ctx.body = rows.map(r => ({
    id: r.id,
    contentType: r.content_type,
    createdAt: r.created_at,
    viewCount: r.view_count,
    maxViews: r.max_views,
    burned: !!r.burned,
  }));
});

// ─── Sent: Get secrets sent BY a user ───────────────────────────────────────
secretsRouter.get("/sent/:userId", async (ctx: Context) => {
  const userId = ctx.params["userId"];
  const rows = secretStmts.sent.all(userId!) as any[];
  ctx.body = rows.map(r => ({
    id: r.id,
    contentType: r.content_type,
    recipientHandle: r.recipient_handle,
    createdAt: r.created_at,
    viewCount: r.view_count,
    maxViews: r.max_views,
    burned: !!r.burned,
  }));
});
