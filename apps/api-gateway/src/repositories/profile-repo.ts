import db from "../db.js";

type Stmt = {
  run: (...args: any[]) => unknown;
  get: (...args: any[]) => unknown;
  all: (...args: any[]) => unknown[];
};

export const profileRepo = {
  updateProfile: db.prepare(`UPDATE users SET bio = ?, avatar_url = ?, socials = ?, accepts_secrets = ? WHERE id = ?`) as unknown as Stmt,
  insertFollow: db.prepare(
    `INSERT OR IGNORE INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)`,
  ) as unknown as Stmt,
  deleteFollow: db.prepare(`DELETE FROM follows WHERE follower_id = ? AND following_id = ?`) as unknown as Stmt,
  isFollowing: db.prepare(`SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?`) as unknown as Stmt,
  countFollowers: db.prepare(`SELECT COUNT(*) as count FROM follows WHERE following_id = ?`) as unknown as Stmt,
  countFollowing: db.prepare(`SELECT COUNT(*) as count FROM follows WHERE follower_id = ?`) as unknown as Stmt,
  followingIdsOf: db.prepare(`SELECT following_id FROM follows WHERE follower_id = ?`) as unknown as Stmt,
  listFollowers: db.prepare(
    `SELECT u.id, u.handle, u.bio, u.avatar_url, u.is_pro
     FROM follows f JOIN users u ON u.id = f.follower_id
     WHERE f.following_id = ? ORDER BY f.created_at DESC`,
  ) as unknown as Stmt,
  listFollowing: db.prepare(
    `SELECT u.id, u.handle, u.bio, u.avatar_url, u.is_pro
     FROM follows f JOIN users u ON u.id = f.following_id
     WHERE f.follower_id = ? ORDER BY f.created_at DESC`,
  ) as unknown as Stmt,
};

export function withFollowState(rows: Array<Record<string, unknown>>, requesterId: string) {
  const ids = profileRepo.followingIdsOf.all(requesterId) as Array<{ following_id: string }>;
  const followingSet = new Set(ids.map((r) => r.following_id));
  return rows.map((r) => ({
    id: r.id,
    handle: r.handle,
    bio: r.bio ?? null,
    avatarUrl: r.avatar_url ?? null,
    isPro: !!r.is_pro,
    isFollowing: followingSet.has(String(r.id)),
  }));
}
