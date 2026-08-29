import { nanoid } from "nanoid";
import db from "../db.js";
import { blobStore } from "../lib/blob-store.js";

const stmts = {
  due: db.prepare(
    `SELECT id, user_id FROM deletion_requests WHERE status = 'pending' AND execute_at <= ?`,
  ),
  markExecuted: db.prepare(
    `UPDATE deletion_requests SET status = 'executed', executed_at = ? WHERE id = ?`,
  ),
  getUser: db.prepare(`SELECT id, handle FROM users WHERE id = ?`),
  blobPathsBySender: db.prepare(
    `SELECT blob_path FROM secrets WHERE sender_id = ? AND blob_path IS NOT NULL`,
  ),
  mediaPathsByHandle: db.prepare(
    `SELECT media_path FROM map_secrets WHERE handle = ? AND media_path IS NOT NULL`,
  ),
};

/** Permanently erase all data belonging to a user. Runs in a transaction. */
const purgeUser = db.transaction((userId: string, handle: string) => {
  db.prepare(`DELETE FROM dm_messages WHERE sender_id = ? OR recipient_id = ?`).run(userId, userId);
  db.prepare(`DELETE FROM conversations WHERE participant1_id = ? OR participant2_id = ?`).run(userId, userId);
  db.prepare(`DELETE FROM dm_device_keys WHERE user_id = ?`).run(userId);
  db.prepare(`DELETE FROM dm_keys WHERE user_id = ?`).run(userId);
  db.prepare(`DELETE FROM secrets WHERE sender_id = ?`).run(userId);
  db.prepare(`DELETE FROM map_secrets WHERE handle = ?`).run(handle);
  db.prepare(`DELETE FROM follows WHERE follower_id = ? OR following_id = ?`).run(userId, userId);
  db.prepare(`DELETE FROM notifications WHERE user_id = ?`).run(userId);
  db.prepare(`DELETE FROM push_subscriptions WHERE user_id = ?`).run(userId);
  db.prepare(`DELETE FROM credentials WHERE user_id = ?`).run(userId);
  db.prepare(`DELETE FROM recovery_codes WHERE user_id = ?`).run(userId);
  db.prepare(`DELETE FROM challenges WHERE user_id = ?`).run(userId);
  db.prepare(`DELETE FROM appeals WHERE user_id = ?`).run(userId);
  db.prepare(`DELETE FROM user_suspensions WHERE user_id = ?`).run(userId);
  db.prepare(`DELETE FROM ivs_channels WHERE user_id = ?`).run(userId);
  db.prepare(`DELETE FROM streams WHERE user_id = ?`).run(userId);
  // Keep reports the user filed for moderation integrity, but detach identity.
  db.prepare(`UPDATE secret_reports SET reporter_user_id = NULL WHERE reporter_user_id = ?`).run(userId);
  // The deletion_requests rows reference users(id); the audit_log entry (written
  // by the sweep, with no FK) is the durable record that erasure happened.
  db.prepare(`DELETE FROM deletion_requests WHERE user_id = ?`).run(userId);
  db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
});

async function unlinkBlobs(paths: string[]): Promise<void> {
  await Promise.all(paths.filter(Boolean).map((p) => blobStore.delete(p).catch(() => {})));
}

/** Process every deletion request whose grace period has elapsed. */
export async function runDeletionSweep(): Promise<number> {
  const now = new Date().toISOString();
  const due = stmts.due.all(now) as Array<{ id: string; user_id: string }>;
  let processed = 0;

  for (const req of due) {
    const user = stmts.getUser.get(req.user_id) as { id: string; handle: string } | undefined;

    if (user) {
      const blobPaths = [
        ...(stmts.blobPathsBySender.all(user.id) as Array<{ blob_path: string }>).map((r) => r.blob_path),
        ...(stmts.mediaPathsByHandle.all(user.handle) as Array<{ media_path: string }>).map((r) => r.media_path),
      ];
      purgeUser(user.id, user.handle);
      await unlinkBlobs(blobPaths);

      db.prepare(
        `INSERT INTO audit_log (id, actor_id, actor_handle, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(nanoid(), "system", "system", "account_deleted", "user", user.id, "GDPR Art. 17 erasure", now);
    }

    stmts.markExecuted.run(now, req.id);
    processed++;
  }

  return processed;
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Start the recurring deletion sweep (on boot + hourly). */
export function startDeletionJob(): void {
  if (timer) return;
  runDeletionSweep().catch((e) => console.error("[deletion] sweep failed:", e));
  timer = setInterval(() => {
    runDeletionSweep().catch((e) => console.error("[deletion] sweep failed:", e));
  }, 60 * 60_000);
  timer.unref?.();
}
