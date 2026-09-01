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

// ─── Migration helpers ──────────────────────────────────────────────────────
// Versioned migration bookkeeping. Every applied migration is recorded so we
// can tell "already applied" apart from "failed" — unlike the old
// `try { ALTER } catch {}` pattern which silently swallowed real errors.
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`);

const migrationApplied = db.prepare("SELECT 1 FROM schema_migrations WHERE id = ?");
const recordMigration = db.prepare(
  "INSERT OR IGNORE INTO schema_migrations (id, applied_at) VALUES (?, ?)",
);

/** Run a migration exactly once, keyed by a stable id. */
function migrate(id: string, fn: () => void): void {
  if (migrationApplied.get(id)) return;
  fn();
  recordMigration.run(id, new Date().toISOString());
}

/** Idempotently add a column, checking the live schema instead of catching errors. */
function addColumn(table: string, column: string, definition: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

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
    location_name TEXT,
    city_name TEXT,
    media_path TEXT,
    media_type TEXT,
    reveal_mode TEXT DEFAULT 'timer',
    reveal_timer_seconds INTEGER DEFAULT 30,
    max_clicks INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
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

// ─── Migrations (idempotent, tracked in schema_migrations) ──────────────────
migrate("map_secrets.columns.v1", () => {
  // Geocoded labels shown on the map + in the admin console. Their absence was
  // a latent crash: routes INSERT/SELECT these columns on every map secret.
  addColumn("map_secrets", "location_name", "TEXT");
  addColumn("map_secrets", "city_name", "TEXT");
  addColumn("map_secrets", "media_path", "TEXT");
  addColumn("map_secrets", "media_type", "TEXT");
  addColumn("map_secrets", "reveal_mode", "TEXT DEFAULT 'timer'");
  addColumn("map_secrets", "reveal_timer_seconds", "INTEGER DEFAULT 30");
  addColumn("map_secrets", "max_clicks", "INTEGER DEFAULT 0");
  addColumn("map_secrets", "click_count", "INTEGER DEFAULT 0");
});

// Client-encrypted map drops: store ciphertext + nonce + MASTER_KEY-wrapped DEK.
// Legacy plaintext rows are expired immediately so we never keep serving them.
migrate("map_secrets.country_name.v1", () => {
  addColumn("map_secrets", "country_name", "TEXT");
});

migrate("map_secrets.encrypt.v1", () => {
  addColumn("map_secrets", "ciphertext", "TEXT");
  addColumn("map_secrets", "nonce", "TEXT");
  addColumn("map_secrets", "wrapped_key", "TEXT");
  db.exec(`
    UPDATE map_secrets
    SET expires_at = datetime('now')
    WHERE ciphertext IS NULL OR ciphertext = '';
  `);
});

// E2E key delivery for profile-addressed secrets (wrapped to recipient's X25519 key)
migrate("secrets.wrap.v1", () => {
  addColumn("secrets", "wrapped_key", "TEXT");
  addColumn("secrets", "wrap_nonce", "TEXT");
  addColumn("secrets", "wrap_epk", "TEXT");
});

// Profile secrets: store configured TTL and defer link expiry until first reveal.
migrate("secrets.ttl_on_reveal.v1", () => {
  addColumn("secrets", "ttl_seconds", "INTEGER");
  db.exec(`
    UPDATE secrets
    SET ttl_seconds = CAST((julianday(expires_at) - julianday(created_at)) * 86400 AS INTEGER)
    WHERE recipient_handle IS NOT NULL AND ttl_seconds IS NULL;
    UPDATE secrets
    SET expires_at = '2099-12-31T23:59:59.000Z'
    WHERE recipient_handle IS NOT NULL AND view_count = 0 AND burned = 0;
  `);
});

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
migrate("users.role.v1", () => {
  addColumn("users", "role", "TEXT NOT NULL DEFAULT 'user'");
});

// Whether the user's public profile shows the "secret box" (accepts secrets).
migrate("users.accepts_secrets.v1", () => {
  addColumn("users", "accepts_secrets", "INTEGER NOT NULL DEFAULT 1");
});

// secret_reports table — MUST be created before the column migration below so
// a fresh database bootstraps cleanly.
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

// Expand pre-existing secret_reports tables that lack the moderation columns.
migrate("secret_reports.columns.v1", () => {
  addColumn("secret_reports", "actioned_by", "TEXT");
  addColumn("secret_reports", "actioned_at", "TEXT");
  addColumn("secret_reports", "action_type", "TEXT");
  addColumn("secret_reports", "action_reason", "TEXT");
  addColumn("secret_reports", "appeal_status", "TEXT");
  addColumn("secret_reports", "internal_notes", "TEXT");
});

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

// ─── Live Streaming (IVS) ───────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS ivs_channels (
    user_id       TEXT PRIMARY KEY REFERENCES users(id),
    channel_arn   TEXT NOT NULL,
    stream_key    TEXT NOT NULL,
    ingest_ep     TEXT NOT NULL,
    playback_url  TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS streams (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id),
    handle        TEXT,
    title         TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'live',
    viewer_count  INTEGER NOT NULL DEFAULT 0,
    started_at    TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at      TEXT,
    lat           REAL,
    lng           REAL,
    reveal_mode   TEXT NOT NULL DEFAULT 'open',
    reveal_timer_seconds INTEGER DEFAULT 30,
    max_reveals   INTEGER DEFAULT 0,
    reveal_count  INTEGER NOT NULL DEFAULT 0,
    max_viewers   INTEGER NOT NULL DEFAULT 0,
    nsfw          INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_streams_status ON streams(status);
  CREATE INDEX IF NOT EXISTS idx_streams_handle ON streams(handle);
`);

// Migration: add new columns to existing streams table
migrate("streams.columns.v1", () => {
  addColumn("streams", "reveal_mode", "TEXT NOT NULL DEFAULT 'open'");
  addColumn("streams", "reveal_timer_seconds", "INTEGER DEFAULT 30");
  addColumn("streams", "max_reveals", "INTEGER DEFAULT 0");
  addColumn("streams", "reveal_count", "INTEGER NOT NULL DEFAULT 0");
  addColumn("streams", "max_viewers", "INTEGER NOT NULL DEFAULT 0");
  addColumn("streams", "nsfw", "INTEGER NOT NULL DEFAULT 0");
});

// Encrypt IVS stream keys at rest: add a column for the ciphertext form. The
// legacy `stream_key` column is retained for backward compatibility during
// migration but new channels only populate `stream_key_enc`.
migrate("ivs_channels.encrypt.v1", () => {
  addColumn("ivs_channels", "stream_key_enc", "TEXT");
});

// Token revocation (logout / forced sign-out). We store the JWT id (jti) of any
// token that must no longer be accepted, until its natural expiry.
db.exec(`
  CREATE TABLE IF NOT EXISTS revoked_tokens (
    jti TEXT PRIMARY KEY,
    user_id TEXT,
    revoked_at TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_revoked_expires ON revoked_tokens(expires_at);
`);

// ─── Teams: workspaces & feedback (persisted; formerly in-memory) ───────────
db.exec(`
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    region TEXT NOT NULL DEFAULT 'us',
    seat_count INTEGER NOT NULL DEFAULT 1,
    max_seats INTEGER NOT NULL DEFAULT 15,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feedback_channels (
    id TEXT PRIMARY KEY,
    workspace_slug TEXT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'one_way',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feedback_messages (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL REFERENCES feedback_channels(id),
    ciphertext TEXT NOT NULL,
    sentiment_tag TEXT,
    topic_tag TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_feedback_msg_channel ON feedback_messages(channel_id);
`);

// ─── Contact form messages (public form → admin inbox) ──────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS contact_messages (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    message TEXT NOT NULL,
    user_id TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);
`);

// ─── Performance indexes for hot query paths ─────────────────────────────────
// Without these, the inbox/sent lists and the public map endpoint fall back to
// full table scans that degrade as the tables grow.
//   - inbox:  WHERE recipient_handle = ? AND burned = 0 ORDER BY created_at DESC
//   - sent:   WHERE sender_id = ? ORDER BY created_at DESC
//   - map:    WHERE expires_at > ?   (and the expiry sweep: expires_at <= ?)
// Aggregate profile engagement — counters only, no visitor logs (privacy-first).
migrate("profile_stats.v1", () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile_stats (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      profile_views INTEGER NOT NULL DEFAULT 0,
      qr_scans INTEGER NOT NULL DEFAULT 0,
      social_clicks INTEGER NOT NULL DEFAULT 0
    );
  `);
});

migrate("profile_stats_daily.v1", () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile_stats_daily (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day TEXT NOT NULL,
      profile_views INTEGER NOT NULL DEFAULT 0,
      qr_scans INTEGER NOT NULL DEFAULT 0,
      social_clicks INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, day)
    );

    CREATE INDEX IF NOT EXISTS idx_profile_stats_daily_user_day
      ON profile_stats_daily(user_id, day);
  `);
});

migrate("blog_posts.v1", () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      body TEXT NOT NULL,
      cover_image_url TEXT,
      keywords TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      author_id TEXT REFERENCES users(id),
      published_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status, published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
  `);
});

migrate("perf-indexes.v1", () => {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_secrets_recipient_burned_created
      ON secrets(recipient_handle, burned, created_at);
    CREATE INDEX IF NOT EXISTS idx_secrets_sender_created
      ON secrets(sender_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_map_secrets_expires
      ON map_secrets(expires_at);
  `);
});

// Multi-device X25519 public keys for inbox secret delivery.
migrate("dm_device_keys.v1", () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dm_device_keys (
      user_id TEXT NOT NULL REFERENCES users(id),
      device_id TEXT NOT NULL,
      public_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, device_id)
    );
    CREATE INDEX IF NOT EXISTS idx_dm_device_keys_user_updated
      ON dm_device_keys(user_id, updated_at DESC);
  `);
  const now = new Date().toISOString();
  const existing = db.prepare(`SELECT user_id, public_key FROM dm_keys`).all() as Array<{
    user_id: string;
    public_key: string;
  }>;
  const insert = db.prepare(
    `INSERT OR IGNORE INTO dm_device_keys (user_id, device_id, public_key, created_at, updated_at)
     VALUES (?, 'legacy', ?, ?, ?)`,
  );
  for (const row of existing) {
    insert.run(row.user_id, row.public_key, now, now);
  }
});

migrate("dm_device_keys.created_at.v1", () => {
  addColumn("dm_device_keys", "created_at", "TEXT");
  db.exec(`UPDATE dm_device_keys SET created_at = COALESCE(created_at, updated_at, datetime('now')) WHERE created_at IS NULL`);
});

migrate("secrets.wraps_json.v1", () => {
  addColumn("secrets", "wraps_json", "TEXT");
});

migrate("credentials.timestamps.v1", () => {
  addColumn("credentials", "created_at", "TEXT");
  addColumn("credentials", "last_used_at", "TEXT");
  const now = new Date().toISOString();
  db.prepare(`UPDATE credentials SET created_at = ? WHERE created_at IS NULL`).run(now);
});

migrate("recovery_codes.v1", () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS recovery_codes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      code_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      used_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_recovery_codes_user ON recovery_codes(user_id);
  `);
});

migrate("users.last_seen_at.v1", () => {
  addColumn("users", "last_seen_at", "TEXT");
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at)`);
});

migrate("admin_notification_campaigns.v1", () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_notification_campaigns (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      actor_handle TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      audience_json TEXT NOT NULL,
      audience_summary TEXT NOT NULL,
      recipient_count INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_admin_notif_campaigns_created
      ON admin_notification_campaigns(created_at);
  `);
});

migrate("chat_rooms.v1", () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_rooms (
      id TEXT PRIMARY KEY,
      pin_hash TEXT,
      max_members INTEGER NOT NULL,
      member_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_rooms_expires ON chat_rooms(expires_at);

    CREATE TABLE IF NOT EXISTS chat_members (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      is_anonymous INTEGER NOT NULL DEFAULT 1,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      joined_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_members_room ON chat_members(room_id);

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES chat_members(id) ON DELETE CASCADE,
      ciphertext TEXT NOT NULL,
      nonce TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created
      ON chat_messages(room_id, created_at);
  `);
});

export { db };
export default db;
