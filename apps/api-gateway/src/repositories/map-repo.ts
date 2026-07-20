import { nanoid } from "nanoid";
import db from "../db.js";
import { unwrapKey, wrapKey } from "../lib/crypto.js";

const stmts = {
  insert: db.prepare(
    `INSERT INTO map_secrets (id, message, ciphertext, nonce, wrapped_key, lat, lng, emoji, handle, location_name, city_name, country_name, media_path, media_type, reveal_mode, reveal_timer_seconds, max_clicks, click_count, created_at, expires_at) VALUES (?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
  ),
  getActive: db.prepare(`SELECT * FROM map_secrets WHERE expires_at > ?`),
  getById: db.prepare(`SELECT * FROM map_secrets WHERE id = ? AND expires_at > ?`),
  deleteExpired: db.prepare(`DELETE FROM map_secrets WHERE expires_at <= ?`),
  incrementClicks: db.prepare(`UPDATE map_secrets SET click_count = click_count + 1 WHERE id = ?`),
};

const reportStmts = {
  insert: db.prepare(
    `INSERT INTO secret_reports (id, secret_id, reporter_user_id, reason, details, status, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?)`,
  ),
};

function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(str: string): Uint8Array | null {
  try {
    const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return new Uint8Array(Buffer.from(padded, "base64"));
  } catch {
    return null;
  }
}

export function normalizeMapSecretReveal(row: Record<string, unknown>) {
  const base = {
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    emoji: row.emoji,
    handle: row.handle ?? null,
    locationName: row.location_name ?? null,
    cityName: row.city_name ?? null,
    countryName: row.country_name ?? null,
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
    if (!dek) return null;
    return {
      ...base,
      ciphertext: String(row.ciphertext),
      nonce: String(row.nonce),
      key: bytesToBase64Url(dek),
    };
  }

  if (row.message) {
    return { ...base, message: String(row.message), legacy: true };
  }

  return null;
}

export function normalizeMapSecretForList(row: Record<string, unknown>) {
  return {
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    emoji: row.emoji,
    handle: row.handle ?? null,
    locationName: row.location_name ?? null,
    cityName: row.city_name ?? null,
    countryName: row.country_name ?? null,
    hasMedia: !!row.media_path,
    revealMode: row.reveal_mode ?? "timer",
    revealTimerSeconds: row.reveal_timer_seconds ?? 30,
    maxClicks: row.max_clicks ?? 0,
    clickCount: row.click_count ?? 0,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export type MapInsertInput = {
  id: string;
  ciphertext: string;
  nonce: string;
  wrappedKey: string;
  lat: number;
  lng: number;
  emoji: string;
  handle: string | null;
  locationName: string | null;
  cityName: string | null;
  countryName: string | null;
  mediaPath: string | null;
  mediaType: string | null;
  revealMode: string;
  revealTimerSeconds: number;
  maxClicks: number;
  createdAt: string;
  expiresAt: string;
};

export const mapRepo = {
  insert: (input: MapInsertInput) => {
    stmts.insert.run(
      input.id,
      input.ciphertext,
      input.nonce,
      input.wrappedKey,
      input.lat,
      input.lng,
      input.emoji,
      input.handle,
      input.locationName,
      input.cityName,
      input.countryName,
      input.mediaPath,
      input.mediaType,
      input.revealMode,
      input.revealTimerSeconds,
      input.maxClicks,
      input.createdAt,
      input.expiresAt,
    );
  },
  deleteExpired: () => stmts.deleteExpired.run(new Date().toISOString()),
  listActive: () => stmts.getActive.all(new Date().toISOString()) as Array<Record<string, unknown>>,
  getById: (id: string) =>
    stmts.getById.get(id, new Date().toISOString()) as Record<string, unknown> | undefined,
  incrementClicks: (id: string) => stmts.incrementClicks.run(id),
  wrapDek: (dek: Uint8Array) => wrapKey(dek),
  insertReport: (secretId: string, reporterUserId: string | null, reason: string, details: string | null) => {
    reportStmts.insert.run(nanoid(), secretId, reporterUserId, reason, details, new Date().toISOString());
  },
};
