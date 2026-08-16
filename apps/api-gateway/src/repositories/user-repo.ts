import db from "../db.js";

type Stmt = {
  run: (...args: any[]) => unknown;
  get: (...args: any[]) => unknown;
  all: (...args: any[]) => unknown[];
};

export const userRepo = {
  insertUser: db.prepare(`INSERT INTO users (id, handle, email, is_pro, created_at) VALUES (?, ?, ?, 0, ?)`) as unknown as Stmt,
  getUserByHandle: db.prepare(`SELECT * FROM users WHERE handle = ?`) as unknown as Stmt,
  getUserById: db.prepare(`SELECT * FROM users WHERE id = ?`) as unknown as Stmt,
  getUserByEmail: db.prepare(`SELECT * FROM users WHERE email = ?`) as unknown as Stmt,
  searchUsers: db.prepare(
    `SELECT id, handle, bio, avatar_url, is_pro FROM users WHERE handle LIKE ? LIMIT 20`,
  ) as unknown as Stmt,
  getDmKey: db.prepare(`SELECT public_key FROM dm_keys WHERE user_id = ?`) as unknown as Stmt,
  listSitemapHandles: db.prepare(`SELECT handle FROM users ORDER BY created_at DESC LIMIT 5000`) as unknown as Stmt,
};

export function dbUserToPublic(row: Record<string, unknown>) {
  return {
    id: row.id,
    handle: row.handle,
    email: row.email,
    isPro: !!row.is_pro,
    role: row.role ?? "user",
    createdAt: row.created_at,
    bio: row.bio ?? null,
    avatarUrl: row.avatar_url ?? null,
    socials: row.socials ? JSON.parse(String(row.socials)) : [],
    acceptsSecrets: row.accepts_secrets == null ? true : !!row.accepts_secrets,
  };
}
