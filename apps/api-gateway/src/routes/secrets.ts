import Router from "@koa/router";
import { createSecret, revealSecret } from "@secretlink/core";
import type { ContentType } from "@secretlink/core";
import { nanoid } from "nanoid";
import type { Context } from "koa";
import { requireAuth, type AuthPayload } from "../middleware/auth.js";
import { mapPostRateLimiter, blobUploadRateLimiter } from "../middleware/rate-limiter.js";
import db from "../db.js";
import { unwrapKey, wrapKey } from "../lib/crypto.js";
import { blobStore } from "../lib/blob-store.js";
import { createNotification, getUserIdByHandle } from "../notifications.js";

export const secretsRouter = new Router({ prefix: "/secrets" });

// Detect MIME type from file magic bytes
function detectMimeType(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return "video/mp4";
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "video/webm";
  return "application/octet-stream";
}

// ─── SQLite-backed secret store ─────────────────────────────────────────────
const secretStmts = {
  insert: db.prepare(`INSERT INTO secrets (id, ciphertext, content_type, blob_path, blob_size_bytes, mime_type, nonce, view_duration_seconds, max_views, view_count, burned, recipient_handle, sender_id, workspace_id, wrapped_key, wrap_nonce, wrap_epk, ttl_seconds, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  findById: db.prepare(`SELECT * FROM secrets WHERE id = ?`),
  incrementView: db.prepare(`UPDATE secrets SET view_count = view_count + 1 WHERE id = ?`),
  setExpiresAt: db.prepare(`UPDATE secrets SET expires_at = ? WHERE id = ?`),
  burn: db.prepare(`UPDATE secrets SET burned = 1 WHERE id = ?`),
  inbox: db.prepare(`SELECT id, content_type, created_at, view_count, max_views, burned FROM secrets WHERE recipient_handle = ? AND burned = 0 ORDER BY created_at DESC`),
  sent: db.prepare(`SELECT id, content_type, recipient_handle, created_at, view_count, max_views, burned FROM secrets WHERE sender_id = ? ORDER BY created_at DESC`),
};

const mapStmts = {
  insert: db.prepare(`INSERT INTO map_secrets (id, message, ciphertext, nonce, wrapped_key, lat, lng, emoji, handle, location_name, city_name, media_path, media_type, reveal_mode, reveal_timer_seconds, max_clicks, click_count, created_at, expires_at) VALUES (?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`),
  getActive: db.prepare(`SELECT * FROM map_secrets WHERE expires_at > ?`),
  getById: db.prepare(`SELECT * FROM map_secrets WHERE id = ? AND expires_at > ?`),
  deleteExpired: db.prepare(`DELETE FROM map_secrets WHERE expires_at <= ?`),
  incrementClicks: db.prepare(`UPDATE map_secrets SET click_count = click_count + 1 WHERE id = ?`),
};

function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(str: string): Uint8Array | null {
  try {
    const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return new Uint8Array(Buffer.from(padded, "base64"));
  } catch {
    return null;
  }
}

const reportStmts = {
  insert: db.prepare(`INSERT INTO secret_reports (id, secret_id, reporter_user_id, reason, details, status, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?)`),
};

/** Reveal payload: ciphertext + key material for client decrypt (never plaintext). */
function normalizeMapSecretReveal(row: any) {
  const base = {
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    emoji: row.emoji,
    handle: row.handle ?? null,
    locationName: row.location_name ?? null,
    cityName: row.city_name ?? null,
    mediaPath: row.media_path ?? null,
    mediaType: row.media_type ?? null,
    revealMode: row.reveal_mode ?? "timer",
    revealTimerSeconds: row.reveal_timer_seconds ?? 30,
    maxClicks: row.max_clicks ?? 0,
    clickCount: row.click_count ?? 0,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };

  if (row.ciphertext && row.nonce && row.wrapped_key) {
    const dek = unwrapKey(String(row.wrapped_key));
    if (!dek) {
      return null;
    }
    return {
      ...base,
      ciphertext: String(row.ciphertext),
      nonce: String(row.nonce),
      key: bytesToBase64Url(dek),
    };
  }

  // Legacy plaintext rows (should already be expired by migration).
  if (row.message) {
    return { ...base, message: String(row.message), legacy: true };
  }

  return null;
}

/** List-safe version: hides the actual secret content (message, media) so
 *  clients must call POST /reveal to access it. */
function normalizeMapSecretForList(row: any) {
  return {
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    emoji: row.emoji,
    handle: row.handle ?? null,
    locationName: row.location_name ?? null,
    cityName: row.city_name ?? null,
    hasMedia: !!(row.media_path),
    revealMode: row.reveal_mode ?? "timer",
    revealTimerSeconds: row.reveal_timer_seconds ?? 30,
    maxClicks: row.max_clicks ?? 0,
    clickCount: row.click_count ?? 0,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

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
        record.wrappedKey ?? null, record.wrapNonce ?? null, record.wrapEpk ?? null,
        record.ttlSeconds ?? null,
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
        ttlSeconds: row.ttl_seconds ?? undefined,
        workspaceId: row.workspace_id,
        recipientHandle: row.recipient_handle,
        wrappedKey: row.wrapped_key,
        wrapNonce: row.wrap_nonce,
        wrapEpk: row.wrap_epk,
        burned: !!row.burned,
      };
    },
    incrementViewCount: async (id: string) => {
      secretStmts.incrementView.run(id);
    },
    setExpiresAt: async (id: string, expiresAt: Date) => {
      secretStmts.setExpiresAt.run(
        expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt,
        id,
      );
    },
    burn: async (id: string) => {
      const row = secretStmts.findById.get(id) as any;
      secretStmts.burn.run(id);
      if (row?.blob_path) {
        setTimeout(() => {
          blobStore.delete(row.blob_path).catch(() => {});
        }, 60_000);
      }
    },
  },
  kms: { wrap: async (dek: Uint8Array, _wsId?: string) => wrapKey(dek) },
  clock: { now: () => new Date() },
  id: () => nanoid(),
};

secretsRouter.post("/", async (ctx: Context) => {
  const sender = ctx.state.user as AuthPayload | undefined;
  const input = { ...(ctx.request.body as Record<string, unknown>), senderId: sender?.userId };
  const result = await createSecret(deps)(input);
  result.match(
    (val) => {
      ctx.status = 201;
      ctx.body = val;

      // Notify the recipient (if the secret is addressed to a registered handle)
      const body = ctx.request.body as Record<string, unknown>;
      const recipientHandle = body.recipientHandle ? String(body.recipientHandle).replace(/^@/, "").trim() : "";
      if (recipientHandle) {
        const recipientId = getUserIdByHandle(recipientHandle);
        if (recipientId) {
          // Secrets are anonymous — never reveal the sender's identity to the
          // recipient, even when the sender is authenticated. (The sender_id is
          // stored server-side only, to route the "secret_read" notification.)
          createNotification({
            userId: recipientId,
            type: "secret",
            actorId: null,
            actorHandle: null,
            entityId: val.id,
          });
        }
      }
    },
    (e) => {
      ctx.status = e.kind === "invalid_input" ? 400 : 500;
      ctx.body = { error: e.kind };
    },
  );
});

// ─── Map Secrets (must be before /:id to avoid conflicts) ───────────────────
secretsRouter.post("/map", mapPostRateLimiter(), async (ctx: Context) => {
  const body = ctx.request.body as Record<string, unknown>;
  const ciphertext = String(body.ciphertext ?? "").trim();
  const nonce = String(body.nonce ?? "").trim();
  const keyB64 = String(body.key ?? "").trim();
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const emoji = String(body.emoji ?? "💬").slice(0, 4);
  const handle = body.handle ? String(body.handle) : undefined;
  const locationName = body.locationName ? String(body.locationName).slice(0, 160) : null;
  const cityName = body.cityName ? String(body.cityName).slice(0, 80) : null;
  const ttlMinutes = Math.min(Math.max(Number(body.ttlMinutes) || 60, 5), 1440);

  // Verify handle ownership: if a handle is supplied, the user must be
  // authenticated and the handle must match their account.
  if (handle) {
    const authUser = ctx.state?.user as { userId?: string; handle?: string } | undefined;
    if (!authUser) {
      ctx.status = 401;
      ctx.body = { error: "Authentication required to post with a handle" };
      return;
    }
    const normalizedHandle = handle.replace(/^@/, "").toLowerCase();
    const normalizedAuth = (authUser.handle ?? "").replace(/^@/, "").toLowerCase();
    if (normalizedHandle !== normalizedAuth) {
      ctx.status = 403;
      ctx.body = { error: "Cannot post as another user" };
      return;
    }
  }

  if (!ciphertext || !nonce || !keyB64) {
    ctx.status = 400;
    ctx.body = { error: "Encrypted payload required (ciphertext, nonce, key)" };
    return;
  }
  if (ciphertext.length > 4096 || nonce.length > 64 || keyB64.length > 128) {
    ctx.status = 400;
    ctx.body = { error: "Encrypted payload too large" };
    return;
  }
  const dek = base64UrlToBytes(keyB64);
  if (!dek || dek.length !== 32) {
    ctx.status = 400;
    ctx.body = { error: "Invalid encryption key" };
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
  const wrappedKey = wrapKey(dek);

  mapStmts.insert.run(
    id, ciphertext, nonce, wrappedKey, lat, lng, emoji, handle ?? null,
    locationName, cityName, mediaPath, mediaType, revealMode, revealTimerSeconds, maxClicks,
    createdAt, expiresAt,
  );

  ctx.status = 201;
  ctx.body = {
    id, lat, lng, emoji, handle, locationName, cityName, mediaPath, mediaType,
    revealMode, revealTimerSeconds, maxClicks, clickCount: 0, createdAt, expiresAt,
    hasMedia: !!mediaPath,
  };
});

secretsRouter.get("/map", async (ctx: Context) => {
  // Clean up expired
  mapStmts.deleteExpired.run(new Date().toISOString());
  const rows = mapStmts.getActive.all(new Date().toISOString()) as any[];
  ctx.body = rows.map(normalizeMapSecretForList);
});

// Active map secrets for a single handle (powers profile "stories")
secretsRouter.get("/map/by-handle/:handle", async (ctx: Context) => {
  const handle = String(ctx.params["handle"] ?? "").replace(/^@/, "");
  mapStmts.deleteExpired.run(new Date().toISOString());
  const rows = mapStmts.getActive.all(new Date().toISOString()) as any[];
  ctx.body = rows.filter((r) => (r.handle ?? "").replace(/^@/, "") === handle).map(normalizeMapSecretForList);
});

secretsRouter.get("/map/:id", async (ctx: Context) => {
  const id = ctx.params["id"];
  const row = mapStmts.getById.get(id!, new Date().toISOString()) as any;

  if (!row) {
    ctx.status = 404;
    ctx.body = { error: "Secret expired or not found" };
    return;
  }

  // Metadata only — content requires POST /reveal.
  ctx.body = normalizeMapSecretForList(row);
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

  const payload = normalizeMapSecretReveal(row);
  if (!payload) {
    ctx.status = 500;
    ctx.body = { error: "decrypt_failed" };
    return;
  }
  ctx.body = payload;
});

secretsRouter.post("/map/:id/report", async (ctx: Context) => {
  const id = String(ctx.params["id"] ?? "");
  const row = mapStmts.getById.get(id, new Date().toISOString()) as any;
  if (!row) {
    ctx.status = 404;
    ctx.body = { error: "Secret expired or not found" };
    return;
  }

  const body = (ctx.request.body ?? {}) as Record<string, unknown>;
  const reason = String(body.reason ?? "").trim().toLowerCase();
  const details = String(body.details ?? "").trim();
  const allowedReasons = new Set(["spam", "harassment", "hate", "sexual", "violence", "illegal", "other"]);

  if (!allowedReasons.has(reason)) {
    ctx.status = 400;
    ctx.body = { error: "Invalid report reason" };
    return;
  }
  if (details.length > 2000) {
    ctx.status = 400;
    ctx.body = { error: "Report details are too long" };
    return;
  }

  const reporter = ctx.state.user as AuthPayload | undefined;
  reportStmts.insert.run(nanoid(), id, reporter?.userId ?? null, reason, details || null, new Date().toISOString());

  ctx.status = 201;
  ctx.body = { ok: true };
});

secretsRouter.get("/:id", async (ctx: Context) => {
  const id = ctx.params["id"]!;
  const result = await revealSecret(deps)(id);
  result.match(
    (val) => {
      // Augment with E2E key-delivery fields (opaque to the server) so a
      // recipient opening from their inbox can unwrap the AES key.
      const row = secretStmts.findById.get(id) as any;
      ctx.status = 200;
      ctx.body = {
        ...val,
        wrappedKey: row?.wrapped_key ?? null,
        wrapNonce: row?.wrap_nonce ?? null,
        wrapEpk: row?.wrap_epk ?? null,
      };

      // Notify the sender that their secret was read
      if (row?.sender_id) {
        const reader = ctx.state.user as AuthPayload | undefined;
        createNotification({
          userId: row.sender_id,
          type: "secret_read",
          actorId: reader?.userId ?? null,
          actorHandle: reader?.handle ?? null,
          entityId: id,
          data: { recipientHandle: row.recipient_handle ?? null },
        });
      }
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
secretsRouter.post("/blob", blobUploadRateLimiter(), async (ctx: Context) => {
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
  await blobStore.put(blobPath, Buffer.concat(chunks));

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

  const data = await blobStore.get(blobPath);
  if (!data) {
    ctx.status = 404;
    ctx.body = { error: "blob_not_found" };
    return;
  }
  ctx.status = 200;
  ctx.type = detectMimeType(data);
  ctx.set("Cache-Control", "private, max-age=31536000, immutable");
  ctx.body = data;
});

// ─── Inbox: Get secrets sent TO a handle (requires auth) ────────────────────
secretsRouter.get("/inbox/:handle", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  const handle = ctx.params["handle"];
  // Users can only view their own inbox
  if (auth.handle !== handle) {
    ctx.status = 403;
    ctx.body = { error: "forbidden" };
    return;
  }
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

// ─── Sent: Get secrets sent BY a user (requires auth) ───────────────────────
secretsRouter.get("/sent/:userId", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  const userId = ctx.params["userId"];
  // Users can only view their own sent items
  if (auth.userId !== userId) {
    ctx.status = 403;
    ctx.body = { error: "forbidden" };
    return;
  }
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
