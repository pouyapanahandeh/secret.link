import Router from "@koa/router";
import type { Context } from "koa";
import { nanoid } from "nanoid";
import { requireAuth, type AuthPayload } from "../middleware/auth.js";
import db from "../db.js";
import { createIvsChannel, getStreamStatus, stopStream } from "../services/ivs.js";
import { encryptString, decryptString } from "../lib/crypto.js";
import { createNotification } from "../notifications.js";

export const streamsRouter = new Router({ prefix: "/streams" });

// ─── Prepared statements ────────────────────────────────────────────────────

const channelStmts = {
  get: db.prepare(`SELECT * FROM ivs_channels WHERE user_id = ?`),
  insert: db.prepare(
    `INSERT INTO ivs_channels (user_id, channel_arn, stream_key, stream_key_enc, ingest_ep, playback_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ),
};

/**
 * Return the plaintext stream key for a channel row. Stream keys are stored
 * encrypted at rest (stream_key_enc); this decrypts them, falling back to the
 * legacy plaintext `stream_key` column for channels created before encryption.
 */
function decodeStreamKey(channel: ChannelRow): string {
  if (channel.stream_key_enc) {
    const dec = decryptString(channel.stream_key_enc);
    if (dec) return dec;
  }
  return channel.stream_key;
}

const streamStmts = {
  insert: db.prepare(
    `INSERT INTO streams (id, user_id, handle, title, status, started_at, lat, lng, max_viewers, nsfw)
     VALUES (?, ?, ?, ?, 'live', ?, ?, ?, ?, ?)`,
  ),
  getLiveByUser: db.prepare(
    `SELECT * FROM streams WHERE user_id = ? AND status = 'live' ORDER BY started_at DESC LIMIT 1`,
  ),
  getLiveByHandle: db.prepare(
    `SELECT * FROM streams WHERE handle = ? AND status = 'live' ORDER BY started_at DESC LIMIT 1`,
  ),
  getById: db.prepare(`SELECT * FROM streams WHERE id = ?`),
  listLive: db.prepare(
    `SELECT s.*, c.playback_url FROM streams s
     JOIN ivs_channels c ON c.user_id = s.user_id
     WHERE s.status = 'live'
     ORDER BY s.started_at DESC`,
  ),
  end: db.prepare(
    `UPDATE streams SET status = 'ended', ended_at = ? WHERE id = ? AND status = 'live'`,
  ),
  endAllByUser: db.prepare(
    `UPDATE streams SET status = 'ended', ended_at = ? WHERE user_id = ? AND status = 'live'`,
  ),
  updateViewerCount: db.prepare(
    `UPDATE streams SET viewer_count = ? WHERE id = ?`,
  ),
};

interface ChannelRow {
  user_id: string;
  channel_arn: string;
  stream_key: string;
  stream_key_enc: string | null;
  ingest_ep: string;
  playback_url: string;
}

interface StreamRow {
  id: string;
  user_id: string;
  handle: string | null;
  title: string;
  status: string;
  viewer_count: number;
  started_at: string;
  ended_at: string | null;
  lat: number | null;
  lng: number | null;
  max_viewers: number;
  nsfw: number;
  playback_url?: string;
}

function normalizeStream(row: StreamRow, includePlayback = false) {
  return {
    id: row.id,
    handle: row.handle,
    title: row.title,
    status: row.status,
    viewerCount: row.viewer_count,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    lat: row.lat,
    lng: row.lng,
    maxViewers: row.max_viewers,
    nsfw: !!row.nsfw,
    ...(includePlayback && row.playback_url ? { playbackUrl: row.playback_url } : {}),
  };
}

// ─── POST /streams/go-live ──────────────────────────────────────────────────
// Authenticated: broadcaster starts a stream
streamsRouter.post("/go-live", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;
  const body = ctx.request.body as Record<string, unknown>;
  const title = String(body.title ?? "").trim().slice(0, 200) || "Live";
  const lat = body.lat != null ? Number(body.lat) : null;
  const lng = body.lng != null ? Number(body.lng) : null;

  // Max viewers (0 = unlimited)
  const maxViewers = Math.min(Math.max(Math.floor(Number(body.maxViewers) || 0), 0), 1000);
  const nsfw = body.nsfw ? 1 : 0;

  // End any existing live stream for this user
  streamStmts.endAllByUser.run(new Date().toISOString(), auth.userId);

  // Get or create IVS channel for this user
  let channel = channelStmts.get.get(auth.userId) as ChannelRow | undefined;

  if (!channel) {
    const ivsCh = await createIvsChannel(`sl-${auth.handle}`);
    const encKey = encryptString(ivsCh.streamKeyValue);
    channelStmts.insert.run(
      auth.userId,
      ivsCh.channelArn,
      encKey, // legacy column also stores ciphertext (NOT NULL); never plaintext
      encKey,
      ivsCh.ingestEndpoint,
      ivsCh.playbackUrl,
      new Date().toISOString(),
    );
    channel = channelStmts.get.get(auth.userId) as ChannelRow;
  }

  // Create stream record
  const streamId = nanoid();
  streamStmts.insert.run(
    streamId,
    auth.userId,
    auth.handle,
    title,
    new Date().toISOString(),
    lat,
    lng,
    maxViewers,
    nsfw,
  );

  // Notify followers that the user went live
  notifyFollowersOfLive(auth.userId, auth.handle, streamId).catch(() => {});

  // The stream key is returned ONLY here, to the authenticated broadcaster who
  // owns the channel. It is never exposed on any public GET endpoint.
  ctx.status = 201;
  ctx.body = {
    streamId,
    ingestEndpoint: channel.ingest_ep,
    streamKey: decodeStreamKey(channel),
    playbackUrl: channel.playback_url,
    shareLink: `/live/${streamId}`,
  };
});

// ─── POST /streams/end ──────────────────────────────────────────────────────
// Authenticated: broadcaster ends their stream
streamsRouter.post("/end", requireAuth(), async (ctx: Context) => {
  const auth = ctx.state.user as AuthPayload;

  const liveStream = streamStmts.getLiveByUser.get(auth.userId) as StreamRow | undefined;
  if (!liveStream) {
    ctx.status = 404;
    ctx.body = { error: "no_live_stream" };
    return;
  }

  // End in DB
  streamStmts.end.run(new Date().toISOString(), liveStream.id);

  // Stop IVS stream
  const channel = channelStmts.get.get(auth.userId) as ChannelRow | undefined;
  if (channel) {
    await stopStream(channel.channel_arn).catch(() => {});
  }

  ctx.body = { ended: true, streamId: liveStream.id };
});

// ─── GET /streams/live ──────────────────────────────────────────────────────
// Public: list all live streams
streamsRouter.get("/live", async (ctx: Context) => {
  const rows = streamStmts.listLive.all() as StreamRow[];

  // Optionally enrich with real-time viewer count from IVS
  const enriched = rows.map((r) => normalizeStream(r, true));

  ctx.body = enriched;
});

// ─── GET /streams/:id ───────────────────────────────────────────────────────
// Public: get stream details + playback URL
streamsRouter.get("/:id", async (ctx: Context) => {
  const id = ctx.params["id"];
  const row = streamStmts.getById.get(id!) as StreamRow | undefined;
  if (!row) {
    ctx.status = 404;
    ctx.body = { error: "stream_not_found" };
    return;
  }

  // Get playback URL from channel
  const channel = channelStmts.get.get(row.user_id) as ChannelRow | undefined;
  if (channel) {
    row.playback_url = channel.playback_url;
  }

  // Get real-time viewer count from IVS if stream is live
  if (row.status === "live" && channel) {
    const status = await getStreamStatus(channel.channel_arn).catch(() => null);
    if (status?.live) {
      row.viewer_count = status.viewerCount;
      streamStmts.updateViewerCount.run(status.viewerCount, row.id);
    }
    // Do NOT auto-end: IVS may report "not broadcasting" during propagation delay.
    // Only POST /streams/end should end a stream.
  }

  ctx.body = normalizeStream(row, true);
});

// ─── GET /streams/by-handle/:handle ─────────────────────────────────────────
// Public: get live stream for a specific user
streamsRouter.get("/by-handle/:handle", async (ctx: Context) => {
  const handle = String(ctx.params["handle"] ?? "").replace(/^@/, "");
  const row = streamStmts.getLiveByHandle.get(handle) as StreamRow | undefined;

  if (!row) {
    ctx.body = { live: false };
    return;
  }

  const channel = channelStmts.get.get(row.user_id) as ChannelRow | undefined;
  if (channel) {
    row.playback_url = channel.playback_url;
  }

  ctx.body = { live: true, stream: normalizeStream(row, true) };
});

// ─── POST /streams/:id/ping ─────────────────────────────────────────────────
// Public: viewer pings to update viewer count (lightweight)
streamsRouter.post("/:id/ping", async (ctx: Context) => {
  ctx.body = { ok: true };
});

// ─── GET /streams/:id/can-join ───────────────────────────────────────────────
// Public: check if there's room for another viewer
streamsRouter.get("/:id/can-join", async (ctx: Context) => {
  const id = ctx.params["id"];
  const row = streamStmts.getById.get(id!) as StreamRow | undefined;
  if (!row || row.status !== "live") {
    ctx.status = 404;
    ctx.body = { error: "stream_not_found", canJoin: false };
    return;
  }

  const canJoin = row.max_viewers === 0 || row.viewer_count < row.max_viewers;
  ctx.body = { canJoin, viewerCount: row.viewer_count, maxViewers: row.max_viewers };
});

// ─── Helper: notify followers ────────────────────────────────────────────────
async function notifyFollowersOfLive(userId: string, handle: string, streamId: string) {
  const followers = db
    .prepare(`SELECT follower_id FROM follows WHERE following_id = ?`)
    .all(userId) as Array<{ follower_id: string }>;

  for (const f of followers) {
    createNotification({
      userId: f.follower_id,
      type: "secret" as any, // reuse "secret" type for now
      actorId: userId,
      actorHandle: handle,
      entityId: streamId,
      data: { type: "live_stream", title: "went live!" },
    });
  }
}
