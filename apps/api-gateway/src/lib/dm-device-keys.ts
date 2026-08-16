import db from "../db.js";

export const MAX_DEVICE_KEYS = 5;

export type DeviceKeyRow = {
  device_id: string;
  public_key: string;
  created_at: string;
  updated_at: string;
};

const stmts = {
  listByUser: db.prepare(
    `SELECT device_id, public_key, created_at, updated_at FROM dm_device_keys
     WHERE user_id = ? ORDER BY updated_at DESC`,
  ),
  getDevice: db.prepare(
    `SELECT device_id, public_key, created_at, updated_at FROM dm_device_keys
     WHERE user_id = ? AND device_id = ?`,
  ),
  upsert: db.prepare(
    `INSERT INTO dm_device_keys (user_id, device_id, public_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, device_id) DO UPDATE SET
       public_key = excluded.public_key,
       updated_at = excluded.updated_at`,
  ),
  count: db.prepare(`SELECT COUNT(*) AS c FROM dm_device_keys WHERE user_id = ?`),
  deleteDevice: db.prepare(`DELETE FROM dm_device_keys WHERE user_id = ? AND device_id = ?`),
  upsertLegacyProjection: db.prepare(
    `INSERT INTO dm_keys (user_id, public_key) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET public_key = excluded.public_key`,
  ),
  clearLegacyProjection: db.prepare(`DELETE FROM dm_keys WHERE user_id = ?`),
};

export function listDeviceKeys(userId: string): DeviceKeyRow[] {
  return stmts.listByUser.all(userId) as DeviceKeyRow[];
}

export function publicKeysForUser(userId: string): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const row of listDeviceKeys(userId)) {
    if (!row.public_key || seen.has(row.public_key)) continue;
    seen.add(row.public_key);
    keys.push(row.public_key);
  }
  return keys;
}

export function newestPublicKey(userId: string): string | null {
  const keys = publicKeysForUser(userId);
  return keys[0] ?? null;
}

function syncLegacyProjection(userId: string): void {
  const newest = newestPublicKey(userId);
  if (!newest) {
    stmts.clearLegacyProjection.run(userId);
    return;
  }
  stmts.upsertLegacyProjection.run(userId, newest);
}

/**
 * Upsert a device key. Rejects with device_limit when adding a new device
 * would exceed MAX_DEVICE_KEYS (updates to existing device_id always allowed).
 */
export function upsertDeviceKey(
  userId: string,
  deviceId: string,
  publicKey: string,
): { ok: true } | { ok: false; error: "device_limit" } {
  const now = new Date().toISOString();
  const existing = stmts.getDevice.get(userId, deviceId) as DeviceKeyRow | undefined;

  if (!existing) {
    const count = (stmts.count.get(userId) as { c: number } | undefined)?.c ?? 0;
    if (count >= MAX_DEVICE_KEYS) {
      return { ok: false, error: "device_limit" };
    }
  }

  const tx = db.transaction(() => {
    stmts.upsert.run(userId, deviceId, publicKey, existing?.created_at ?? now, now);
    syncLegacyProjection(userId);
  });
  tx();
  return { ok: true };
}

export function revokeDeviceKey(userId: string, deviceId: string): boolean {
  const existing = stmts.getDevice.get(userId, deviceId) as DeviceKeyRow | undefined;
  if (!existing) return false;
  const tx = db.transaction(() => {
    stmts.deleteDevice.run(userId, deviceId);
    syncLegacyProjection(userId);
  });
  tx();
  return true;
}

export function deleteAllDeviceKeys(userId: string): void {
  db.prepare(`DELETE FROM dm_device_keys WHERE user_id = ?`).run(userId);
  stmts.clearLegacyProjection.run(userId);
}
