import Router from "@koa/router";
import { createSecret, revealSecret, CreateSecretInput } from "@secretlink/core";
import { CreateMapSecretInput, MapReportInput } from "@secretlink/core/map/schemas";
import { nanoid } from "nanoid";
import type { Context } from "koa";
import { requireAuth, type AuthPayload } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { mapPostRateLimiter, blobUploadRateLimiter } from "../middleware/rate-limiter.js";
import { coalesceWrapsFromRow, createSecretDeps, secretRepo } from "../repositories/secret-repo.js";
import {
  mapRepo,
  base64UrlToBytes,
  normalizeMapSecretForList,
  normalizeMapSecretReveal,
} from "../repositories/map-repo.js";
import { blobStore } from "../lib/blob-store.js";
import { createNotification, getUserIdByHandle } from "../notifications.js";

export const secretsRouter = new Router({ prefix: "/secrets" });

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

secretsRouter.post("/", validateBody(CreateSecretInput), async (ctx: Context) => {
  const sender = ctx.state.user as AuthPayload | undefined;
  const body = ctx.state.body as Record<string, unknown>;
  const input = { ...body, senderId: sender?.userId };
  const result = await createSecret(createSecretDeps)(input);
  result.match(
    (val) => {
      ctx.status = 201;
      ctx.body = val;

      const recipientHandle = body.recipientHandle ? String(body.recipientHandle).replace(/^@/, "").trim() : "";
      if (recipientHandle) {
        const recipientId = getUserIdByHandle(recipientHandle);
        if (recipientId) {
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
      ctx.body =
        e.kind === "invalid_input"
          ? { error: "validation_error", issues: e.issues }
          : { error: e.kind };
    },
  );
});

secretsRouter.post("/map", mapPostRateLimiter(), validateBody(CreateMapSecretInput), async (ctx: Context) => {
  const body = ctx.state.body as Record<string, unknown>;
  const ciphertext = String(body.ciphertext ?? "").trim();
  const nonce = String(body.nonce ?? "").trim();
  const keyB64 = String(body.key ?? "").trim();
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const emoji = String(body.emoji ?? "💬").slice(0, 4);
  const handle = body.handle ? String(body.handle) : undefined;
  const locationName = body.locationName ? String(body.locationName).slice(0, 160) : null;
  const cityName = body.cityName ? String(body.cityName).slice(0, 80) : null;
  const countryName = body.countryName ? String(body.countryName).slice(0, 80) : null;
  const ttlMinutes = Math.min(Math.max(Number(body.ttlMinutes) || 60, 5), 1440);

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

  const dek = base64UrlToBytes(keyB64);
  if (!dek || dek.length !== 32) {
    ctx.status = 400;
    ctx.body = { error: "Invalid encryption key" };
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
  const wrappedKey = mapRepo.wrapDek(dek);

  mapRepo.insert({
    id,
    ciphertext,
    nonce,
    wrappedKey,
    lat,
    lng,
    emoji,
    handle: handle ?? null,
    locationName,
    cityName,
    countryName,
    mediaPath,
    mediaType,
    revealMode,
    revealTimerSeconds,
    maxClicks,
    createdAt,
    expiresAt,
  });

  ctx.status = 201;
  ctx.body = {
    id, lat, lng, emoji, handle, locationName, cityName, countryName, mediaPath, mediaType,
    revealMode, revealTimerSeconds, maxClicks, clickCount: 0, createdAt, expiresAt,
    hasMedia: !!mediaPath,
  };
});

secretsRouter.get("/map", async (ctx: Context) => {
  mapRepo.deleteExpired();
  ctx.body = mapRepo.listActive().map(normalizeMapSecretForList);
});

secretsRouter.get("/map/by-handle/:handle", async (ctx: Context) => {
  const handle = String(ctx.params["handle"] ?? "").replace(/^@/, "");
  mapRepo.deleteExpired();
  ctx.body = mapRepo
    .listActive()
    .filter((r) => String(r.handle ?? "").replace(/^@/, "") === handle)
    .map(normalizeMapSecretForList);
});

secretsRouter.get("/map/:id", async (ctx: Context) => {
  const row = mapRepo.getById(String(ctx.params["id"] ?? ""));
  if (!row) {
    ctx.status = 404;
    ctx.body = { error: "Secret expired or not found" };
    return;
  }
  ctx.body = normalizeMapSecretForList(row);
});

secretsRouter.post("/map/:id/reveal", async (ctx: Context) => {
  const id = String(ctx.params["id"] ?? "");
  const row = mapRepo.getById(id);
  if (!row) {
    ctx.status = 404;
    ctx.body = { error: "Secret expired or not found" };
    return;
  }

  if (row.reveal_mode === "clicks") {
    const clickCount = Number(row.click_count ?? 0);
    const maxClicks = Number(row.max_clicks ?? 0);
    if (clickCount >= maxClicks) {
      ctx.status = 403;
      ctx.body = { error: "limit_reached", message: `This secret has reached its reveal limit (${maxClicks}).` };
      return;
    }
    mapRepo.incrementClicks(id);
    row.click_count = clickCount + 1;
  }

  const payload = normalizeMapSecretReveal(row);
  if (!payload) {
    ctx.status = 500;
    ctx.body = { error: "decrypt_failed" };
    return;
  }
  ctx.body = payload;
});

secretsRouter.post("/map/:id/report", validateBody(MapReportInput), async (ctx: Context) => {
  const id = String(ctx.params["id"] ?? "");
  if (!mapRepo.getById(id)) {
    ctx.status = 404;
    ctx.body = { error: "Secret expired or not found" };
    return;
  }

  const body = ctx.state.body as { reason: string; details?: string };
  const reporter = ctx.state.user as AuthPayload | undefined;
  mapRepo.insertReport(id, reporter?.userId ?? null, body.reason, String(body.details ?? "").trim() || null);

  ctx.status = 201;
  ctx.body = { ok: true };
});

secretsRouter.get("/:id", async (ctx: Context) => {
  const id = ctx.params["id"]!;
  const result = await revealSecret(createSecretDeps)(id);
  result.match(
    (val) => {
      const row = secretRepo.findRowById(id);
      const wraps = coalesceWrapsFromRow(row);
      ctx.status = 200;
      ctx.body = {
        ...val,
        wrappedKey: row?.wrapped_key ?? wraps[0]?.wrappedKey ?? null,
        wrapNonce: row?.wrap_nonce ?? wraps[0]?.wrapNonce ?? null,
        wrapEpk: row?.wrap_epk ?? wraps[0]?.wrapEpk ?? null,
        wraps,
      };

      if (row?.sender_id) {
        const reader = ctx.state.user as AuthPayload | undefined;
        createNotification({
          userId: String(row.sender_id),
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

secretsRouter.post("/blob", blobUploadRateLimiter(), async (ctx: Context) => {
  const MAX_SIZE = 50 * 1024 * 1024;
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
  ctx.set("Cache-Control", blobPath.startsWith("blog_") ? "public, max-age=86400" : "private, max-age=31536000, immutable");
  ctx.body = data;
});

secretsRouter.get("/inbox/:handle", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  const handle = ctx.params["handle"];
  if (auth.handle !== handle) {
    ctx.status = 403;
    ctx.body = { error: "forbidden" };
    return;
  }
  ctx.body = secretRepo.listInbox(handle!).map((r) => ({
    id: r.id,
    contentType: r.content_type,
    createdAt: r.created_at,
    viewCount: r.view_count,
    maxViews: r.max_views,
    burned: !!r.burned,
  }));
});

secretsRouter.get("/sent/:userId", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  const userId = ctx.params["userId"];
  if (auth.userId !== userId) {
    ctx.status = 403;
    ctx.body = { error: "forbidden" };
    return;
  }
  ctx.body = secretRepo.listSent(userId!).map((r) => ({
    id: r.id,
    contentType: r.content_type,
    recipientHandle: r.recipient_handle,
    createdAt: r.created_at,
    viewCount: r.view_count,
    maxViews: r.max_views,
    burned: !!r.burned,
  }));
});
