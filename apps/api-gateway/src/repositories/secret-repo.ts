import { nanoid } from "nanoid";
import type { ContentType, SecretRecord } from "@secretlink/core";
import db from "../db.js";
import { blobStore } from "../lib/blob-store.js";
import { wrapKey } from "../lib/crypto.js";

const stmts = {
  insert: db.prepare(
    `INSERT INTO secrets (id, ciphertext, content_type, blob_path, blob_size_bytes, mime_type, nonce, view_duration_seconds, max_views, view_count, burned, recipient_handle, sender_id, workspace_id, wrapped_key, wrap_nonce, wrap_epk, wraps_json, ttl_seconds, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ),
  findById: db.prepare(`SELECT * FROM secrets WHERE id = ?`),
  incrementView: db.prepare(`UPDATE secrets SET view_count = view_count + 1 WHERE id = ?`),
  setExpiresAt: db.prepare(`UPDATE secrets SET expires_at = ? WHERE id = ?`),
  burn: db.prepare(`UPDATE secrets SET burned = 1 WHERE id = ?`),
  inbox: db.prepare(
    `SELECT id, content_type, created_at, view_count, max_views, burned FROM secrets WHERE recipient_handle = ? AND burned = 0 ORDER BY created_at DESC`,
  ),
  sent: db.prepare(
    `SELECT id, content_type, recipient_handle, created_at, view_count, max_views, burned FROM secrets WHERE sender_id = ? ORDER BY CASE WHEN burned = 0 AND view_count = 0 THEN 0 ELSE 1 END, created_at DESC`,
  ),
  sentPage: db.prepare(
    `SELECT id, content_type, recipient_handle, created_at, view_count, max_views, burned FROM secrets WHERE sender_id = ? ORDER BY CASE WHEN burned = 0 AND view_count = 0 THEN 0 ELSE 1 END, created_at DESC LIMIT ? OFFSET ?`,
  ),
  sentCount: db.prepare(`SELECT COUNT(*) AS c FROM secrets WHERE sender_id = ?`),
};

function rowToRecord(row: Record<string, unknown>): SecretRecord {
  return {
    id: String(row.id),
    ciphertext: String(row.ciphertext),
    contentType: row.content_type as ContentType,
    blobPath: row.blob_path ? String(row.blob_path) : undefined,
    blobSizeBytes: row.blob_size_bytes != null ? Number(row.blob_size_bytes) : undefined,
    mimeType: row.mime_type ? String(row.mime_type) : undefined,
    nonce: row.nonce ? String(row.nonce) : undefined,
    viewDurationSeconds: row.view_duration_seconds != null ? Number(row.view_duration_seconds) : undefined,
    maxViews: Number(row.max_views),
    viewCount: Number(row.view_count),
    createdAt: new Date(String(row.created_at)),
    expiresAt: new Date(String(row.expires_at)),
    ttlSeconds: row.ttl_seconds != null ? Number(row.ttl_seconds) : undefined,
    workspaceId: row.workspace_id ? String(row.workspace_id) : undefined,
    recipientHandle: row.recipient_handle ? String(row.recipient_handle) : undefined,
    senderId: row.sender_id ? String(row.sender_id) : undefined,
    wrappedKey: row.wrapped_key ? String(row.wrapped_key) : undefined,
    wrapNonce: row.wrap_nonce ? String(row.wrap_nonce) : undefined,
    wrapEpk: row.wrap_epk ? String(row.wrap_epk) : undefined,
    wrapsJson: row.wraps_json ? String(row.wraps_json) : undefined,
    burned: !!row.burned,
  };
}

export function coalesceWrapsFromRow(row: Record<string, unknown> | undefined | null): Array<{
  wrappedKey: string;
  wrapNonce: string;
  wrapEpk: string;
}> {
  if (!row) return [];
  if (row.wraps_json) {
    try {
      const parsed = JSON.parse(String(row.wraps_json));
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (w) =>
            w &&
            typeof w.wrappedKey === "string" &&
            typeof w.wrapNonce === "string" &&
            typeof w.wrapEpk === "string",
        );
      }
    } catch {
      /* fall through to legacy */
    }
  }
  if (row.wrapped_key && row.wrap_nonce && row.wrap_epk) {
    return [
      {
        wrappedKey: String(row.wrapped_key),
        wrapNonce: String(row.wrap_nonce),
        wrapEpk: String(row.wrap_epk),
      },
    ];
  }
  return [];
}

export const secretRepo = {
  save: async (record: SecretRecord) => {
    stmts.insert.run(
      record.id,
      record.ciphertext,
      record.contentType,
      record.blobPath ?? null,
      record.blobSizeBytes ?? null,
      record.mimeType ?? null,
      record.nonce ?? null,
      record.viewDurationSeconds ?? null,
      record.maxViews,
      record.recipientHandle ?? null,
      record.senderId ?? null,
      record.workspaceId ?? null,
      record.wrappedKey ?? null,
      record.wrapNonce ?? null,
      record.wrapEpk ?? null,
      record.wrapsJson ?? null,
      record.ttlSeconds ?? null,
      record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
      record.expiresAt instanceof Date ? record.expiresAt.toISOString() : record.expiresAt,
    );
  },
  findById: async (id: string) => {
    const row = stmts.findById.get(id) as Record<string, unknown> | undefined;
    return row ? rowToRecord(row) : null;
  },
  findRowById: (id: string) => stmts.findById.get(id) as Record<string, unknown> | undefined,
  incrementViewCount: async (id: string) => {
    stmts.incrementView.run(id);
  },
  setExpiresAt: async (id: string, expiresAt: Date) => {
    stmts.setExpiresAt.run(expiresAt.toISOString(), id);
  },
  burn: async (id: string) => {
    const row = stmts.findById.get(id) as { blob_path?: string } | undefined;
    stmts.burn.run(id);
    if (row?.blob_path) {
      setTimeout(() => {
        blobStore.delete(row.blob_path!).catch(() => {});
      }, 60_000);
    }
  },
  listInbox: (handle: string) => stmts.inbox.all(handle) as Array<Record<string, unknown>>,
  listSent: (userId: string) => stmts.sent.all(userId) as Array<Record<string, unknown>>,
  listSentPage: (userId: string, limit: number, offset: number) =>
    stmts.sentPage.all(userId, limit, offset) as Array<Record<string, unknown>>,
  countSent: (userId: string) => {
    const row = stmts.sentCount.get(userId) as { c: number } | undefined;
    return Number(row?.c ?? 0);
  },
};

export const createSecretDeps = {
  repo: secretRepo,
  kms: { wrap: async (dek: Uint8Array, _wsId?: string) => wrapKey(dek) },
  clock: { now: () => new Date() },
  id: () => nanoid(),
};
