import Database from "better-sqlite3";
import type BetterSqlite3 from "better-sqlite3";
import path from "node:path";
import { mkdirSync } from "node:fs";

const DB_PATH = process.env["DB_PATH"] ?? path.resolve(process.cwd(), "data", "secretlink.db");

// Ensure data directory exists (skip for in-memory DBs)
if (DB_PATH !== ":memory:") {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db: BetterSqlite3.Database = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ─── Schema ─────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    handle TEXT UNIQUE NOT NULL,
    email TEXT,
    is_pro INTEGER DEFAULT 0,
    bio TEXT,
    avatar_url TEXT,
    socials TEXT DEFAULT '[]',
    magic_link_token TEXT,
    magic_link_expires_at INTEGER,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle);

  CREATE TABLE IF NOT EXISTS credentials (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    public_key BLOB NOT NULL,
    counter INTEGER DEFAULT 0,
    transports TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS follows (
    follower_id TEXT NOT NULL REFERENCES users(id),
    following_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (follower_id, following_id)
  );

  CREATE TABLE IF NOT EXISTS secrets (
    id TEXT PRIMARY KEY,
    ciphertext TEXT NOT NULL,
    content_type TEXT NOT NULL,
    blob_path TEXT,
    blob_size_bytes INTEGER,
    mime_type TEXT,
    nonce TEXT,
    view_duration_seconds INTEGER,
    max_views INTEGER DEFAULT 1,
    view_count INTEGER DEFAULT 0,
    burned INTEGER DEFAULT 0,
    recipient_handle TEXT,
    sender_id TEXT,
    workspace_id TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS map_secrets (
    id TEXT PRIMARY KEY,
    message TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    emoji TEXT DEFAULT '💬',
    handle TEXT,
    media_path TEXT,
    media_type TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dm_keys (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    public_key TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    participant1_id TEXT NOT NULL,
    participant1_handle TEXT NOT NULL,
    participant2_id TEXT NOT NULL,
    participant2_handle TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_message_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dm_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    sender_id TEXT NOT NULL,
    sender_handle TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    encrypted_content TEXT NOT NULL,
    nonce TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    read_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_conv_participant1 ON conversations(participant1_id);
  CREATE INDEX IF NOT EXISTS idx_conv_participant2 ON conversations(participant2_id);
  CREATE INDEX IF NOT EXISTS idx_dm_msg_conv_expires ON dm_messages(conversation_id, expires_at);
  CREATE INDEX IF NOT EXISTS idx_dm_msg_conv_created ON dm_messages(conversation_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_dm_msg_recipient_read ON dm_messages(recipient_id, read_at);
`);

// ─── Migrations (safe to re-run) ────────────────────────────────────────────
try { db.exec(`ALTER TABLE map_secrets ADD COLUMN media_path TEXT`); } catch {}
try { db.exec(`ALTER TABLE map_secrets ADD COLUMN media_type TEXT`); } catch {}try { db.exec(`ALTER TABLE map_secrets ADD COLUMN reveal_mode TEXT DEFAULT 'timer'`); } catch {}
try { db.exec(`ALTER TABLE map_secrets ADD COLUMN reveal_timer_seconds INTEGER DEFAULT 30`); } catch {}
try { db.exec(`ALTER TABLE map_secrets ADD COLUMN max_clicks INTEGER DEFAULT 0`); } catch {}
try { db.exec(`ALTER TABLE map_secrets ADD COLUMN click_count INTEGER DEFAULT 0`); } catch {}

// E2E key delivery for profile-addressed secrets (wrapped to recipient's X25519 key)
try { db.exec(`ALTER TABLE secrets ADD COLUMN wrapped_key TEXT`); } catch {}
try { db.exec(`ALTER TABLE secrets ADD COLUMN wrap_nonce TEXT`); } catch {}
try { db.exec(`ALTER TABLE secrets ADD COLUMN wrap_epk TEXT`); } catch {}

// Challenges table for WebAuthn
db.exec(`
  CREATE TABLE IF NOT EXISTS challenges (
    user_id TEXT PRIMARY KEY,
    challenge TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);

// Rate limit table
db.exec(`
  CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    reset_at INTEGER NOT NULL
  );
`);

// Notifications table
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    actor_id TEXT,
    actor_handle TEXT,
    entity_id TEXT,
    data TEXT,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_notif_user_created ON notifications(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_notif_user_read ON notifications(user_id, read);
`);

// Web Push subscriptions (one row per browser/device endpoint)
db.exec(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions(user_id);
`);

// ─── Conversations FK migration (safe to re-run) ────────────────────────────
try {
  const hasFK = db.prepare(`SELECT sql FROM sqlite_master WHERE name = 'conversations'`).get() as any;
  if (hasFK && !hasFK.sql.includes("REFERENCES")) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversations_new (
        id TEXT PRIMARY KEY,
        participant1_id TEXT NOT NULL REFERENCES users(id),
        participant1_handle TEXT NOT NULL,
        participant2_id TEXT NOT NULL REFERENCES users(id),
        participant2_handle TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_message_at TEXT NOT NULL
      );
      INSERT OR IGNORE INTO conversations_new SELECT * FROM conversations;
      DROP TABLE conversations;
      ALTER TABLE conversations_new RENAME TO conversations;
      CREATE INDEX IF NOT EXISTS idx_conv_participant1 ON conversations(participant1_id);
      CREATE INDEX IF NOT EXISTS idx_conv_participant2 ON conversations(participant2_id);
    `);
  }
} catch {}

// ─── Phase 1: Admin & Compliance migrations ─────────────────────────────────

// Add role column to users
try { db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`); } catch {}

// Expand secret_reports table
try { db.exec(`ALTER TABLE secret_reports ADD COLUMN actioned_by TEXT`); } catch {}
try { db.exec(`ALTER TABLE secret_reports ADD COLUMN actioned_at TEXT`); } catch {}
try { db.exec(`ALTER TABLE secret_reports ADD COLUMN action_type TEXT`); } catch {}
try { db.exec(`ALTER TABLE secret_reports ADD COLUMN action_reason TEXT`); } catch {}
try { db.exec(`ALTER TABLE secret_reports ADD COLUMN appeal_status TEXT`); } catch {}
try { db.exec(`ALTER TABLE secret_reports ADD COLUMN internal_notes TEXT`); } catch {}

// secret_reports table (in case it doesn't exist yet)
db.exec(`
  CREATE TABLE IF NOT EXISTS secret_reports (
    id TEXT PRIMARY KEY,
    secret_id TEXT NOT NULL,
    reporter_user_id TEXT,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    actioned_by TEXT,
    actioned_at TEXT,
    action_type TEXT,
    action_reason TEXT,
    appeal_status TEXT,
    internal_notes TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_reports_status ON secret_reports(status);
  CREATE INDEX IF NOT EXISTS idx_reports_secret ON secret_reports(secret_id);
`);

// Audit log
db.exec(`
  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL,
    actor_handle TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    details TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
`);

// Appeals table (Phase 2)
db.exec(`
  CREATE TABLE IF NOT EXISTS appeals (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES secret_reports(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at TEXT,
    resolution_note TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status);
  CREATE INDEX IF NOT EXISTS idx_appeals_user ON appeals(user_id);
`);

// Account deletion requests (Phase 2)
db.exec(`
  CREATE TABLE IF NOT EXISTS deletion_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    requested_at TEXT NOT NULL,
    execute_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    executed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_deletion_user ON deletion_requests(user_id);
  CREATE INDEX IF NOT EXISTS idx_deletion_status ON deletion_requests(status);
`);

// User suspensions
db.exec(`
  CREATE TABLE IF NOT EXISTS user_suspensions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    suspended_by TEXT NOT NULL,
    suspended_at TEXT NOT NULL,
    expires_at TEXT,
    lifted_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_suspension_user ON user_suspensions(user_id);
`);

export { db };
export default db;
