import { nanoid } from "nanoid";
import db from "../db.js";
import { chatsHub } from "../lib/chat-sse.js";

export type ChatRoomRow = {
  id: string;
  pin_hash: string | null;
  pin_length: number | null;
  max_members: number;
  member_count: number;
  created_at: string;
  expires_at: string;
};

export type ChatMemberRow = {
  id: string;
  room_id: string;
  display_name: string;
  is_anonymous: number;
  user_id: string | null;
  joined_at: string;
};

export type ChatMessageRow = {
  id: string;
  room_id: string;
  member_id: string;
  ciphertext: string;
  nonce: string;
  created_at: string;
};

const stmts = {
  insertRoom: db.prepare(
    `INSERT INTO chat_rooms (id, pin_hash, pin_length, max_members, member_count, created_at, expires_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
  ),
  findRoom: db.prepare(`SELECT * FROM chat_rooms WHERE id = ?`),
  expiredIds: db.prepare(`SELECT id FROM chat_rooms WHERE expires_at <= ?`),
  deleteMessagesForRooms: db.prepare(
    `DELETE FROM chat_messages WHERE room_id IN (SELECT id FROM chat_rooms WHERE expires_at <= ?)`,
  ),
  deleteMembersForRooms: db.prepare(
    `DELETE FROM chat_members WHERE room_id IN (SELECT id FROM chat_rooms WHERE expires_at <= ?)`,
  ),
  deleteExpiredRooms: db.prepare(`DELETE FROM chat_rooms WHERE expires_at <= ?`),
  deleteMessagesForRoom: db.prepare(`DELETE FROM chat_messages WHERE room_id = ?`),
  deleteMembersForRoom: db.prepare(`DELETE FROM chat_members WHERE room_id = ?`),
  deleteRoom: db.prepare(`DELETE FROM chat_rooms WHERE id = ?`),
  insertMember: db.prepare(
    `INSERT INTO chat_members (id, room_id, display_name, is_anonymous, user_id, joined_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ),
  incrementMembers: db.prepare(
    `UPDATE chat_rooms SET member_count = member_count + 1 WHERE id = ? AND member_count < max_members`,
  ),
  findMember: db.prepare(`SELECT * FROM chat_members WHERE id = ? AND room_id = ?`),
  findIdentityMember: db.prepare(
    `SELECT * FROM chat_members WHERE room_id = ? AND user_id = ? AND is_anonymous = 0 ORDER BY joined_at ASC LIMIT 1`,
  ),
  listMine: db.prepare(
    `SELECT r.id, r.expires_at, r.member_count, r.max_members, r.pin_hash,
            m.display_name, m.joined_at
     FROM chat_members m
     JOIN chat_rooms r ON r.id = m.room_id
     WHERE m.user_id = ? AND m.is_anonymous = 0 AND r.expires_at > ?
     ORDER BY r.expires_at ASC`,
  ),
  listMembers: db.prepare(`SELECT id, display_name FROM chat_members WHERE room_id = ? ORDER BY joined_at ASC`),
  insertMessage: db.prepare(
    `INSERT INTO chat_messages (id, room_id, member_id, ciphertext, nonce, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ),
  listMessages: db.prepare(
    `SELECT m.id, m.room_id, m.member_id, m.ciphertext, m.nonce, m.created_at, mem.display_name
     FROM chat_messages m
     JOIN chat_members mem ON mem.id = m.member_id
     WHERE m.room_id = ?
     ORDER BY m.created_at ASC`,
  ),
};

export function isExpired(room: ChatRoomRow, now = new Date()): boolean {
  return new Date(room.expires_at).getTime() <= now.getTime();
}

export function findRoom(id: string): ChatRoomRow | undefined {
  return stmts.findRoom.get(id) as ChatRoomRow | undefined;
}

export function findMember(memberId: string, roomId: string): ChatMemberRow | undefined {
  return stmts.findMember.get(memberId, roomId) as ChatMemberRow | undefined;
}

export function findIdentityMember(roomId: string, userId: string): ChatMemberRow | undefined {
  return stmts.findIdentityMember.get(roomId, userId) as ChatMemberRow | undefined;
}

export type ActiveChatRow = {
  id: string;
  expiresAt: string;
  memberCount: number;
  maxMembers: number;
  hasPin: boolean;
  displayName: string;
  joinedAt: string;
};

export function listActiveChatsForUser(userId: string, now = new Date()): ActiveChatRow[] {
  const rows = stmts.listMine.all(userId, now.toISOString()) as Array<{
    id: string;
    expires_at: string;
    member_count: number;
    max_members: number;
    pin_hash: string | null;
    display_name: string;
    joined_at: string;
  }>;
  const seen = new Set<string>();
  const items: ActiveChatRow[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    items.push({
      id: r.id,
      expiresAt: r.expires_at,
      memberCount: r.member_count,
      maxMembers: r.max_members,
      hasPin: Boolean(r.pin_hash),
      displayName: r.display_name,
      joinedAt: r.joined_at,
    });
  }
  return items;
}

export function createRoom(input: {
  pinHash: string | null;
  pinLength: number | null;
  maxMembers: number;
  createdAt: string;
  expiresAt: string;
}): ChatRoomRow {
  const id = nanoid();
  stmts.insertRoom.run(
    id,
    input.pinHash,
    input.pinLength,
    input.maxMembers,
    input.createdAt,
    input.expiresAt,
  );
  return {
    id,
    pin_hash: input.pinHash,
    pin_length: input.pinLength,
    max_members: input.maxMembers,
    member_count: 0,
    created_at: input.createdAt,
    expires_at: input.expiresAt,
  };
}

const joinTx = db.transaction(
  (roomId: string, displayName: string, isAnonymous: number, userId: string | null, joinedAt: string) => {
    const bumped = stmts.incrementMembers.run(roomId);
    if (bumped.changes !== 1) return null;
    const id = nanoid();
    stmts.insertMember.run(id, roomId, displayName, isAnonymous, userId, joinedAt);
    return id;
  },
);

export function joinRoom(input: {
  roomId: string;
  displayName: string;
  isAnonymous: boolean;
  userId: string | null;
}): { memberId: string; joinedAt: string } | { full: true } {
  const joinedAt = new Date().toISOString();
  const memberId = joinTx(
    input.roomId,
    input.displayName,
    input.isAnonymous ? 1 : 0,
    input.userId,
    joinedAt,
  );
  if (!memberId) return { full: true };
  return { memberId, joinedAt };
}

export function listMembers(roomId: string): Array<{ id: string; displayName: string }> {
  const rows = stmts.listMembers.all(roomId) as Array<{ id: string; display_name: string }>;
  return rows.map((r) => ({ id: r.id, displayName: r.display_name }));
}

export function insertMessage(input: {
  roomId: string;
  memberId: string;
  ciphertext: string;
  nonce: string;
}): ChatMessageRow {
  const id = nanoid();
  const createdAt = new Date().toISOString();
  stmts.insertMessage.run(id, input.roomId, input.memberId, input.ciphertext, input.nonce, createdAt);
  return {
    id,
    room_id: input.roomId,
    member_id: input.memberId,
    ciphertext: input.ciphertext,
    nonce: input.nonce,
    created_at: createdAt,
  };
}

export function listMessages(roomId: string): Array<{
  id: string;
  memberId: string;
  displayName: string;
  ciphertext: string;
  nonce: string;
  createdAt: string;
}> {
  const rows = stmts.listMessages.all(roomId) as Array<{
    id: string;
    member_id: string;
    display_name: string;
    ciphertext: string;
    nonce: string;
    created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    displayName: r.display_name,
    ciphertext: r.ciphertext,
    nonce: r.nonce,
    createdAt: r.created_at,
  }));
}

const purgeRoomTx = db.transaction((roomId: string) => {
  stmts.deleteMessagesForRoom.run(roomId);
  stmts.deleteMembersForRoom.run(roomId);
  stmts.deleteRoom.run(roomId);
});

/** Hard-delete one room and all of its members/messages. */
export function purgeRoom(roomId: string): void {
  purgeRoomTx(roomId);
  chatsHub.disconnectChannel(roomId);
}

const purgeExpiredTx = db.transaction((now: string) => {
  const ids = (stmts.expiredIds.all(now) as Array<{ id: string }>).map((r) => r.id);
  stmts.deleteMessagesForRooms.run(now);
  stmts.deleteMembersForRooms.run(now);
  stmts.deleteExpiredRooms.run(now);
  return ids;
});

/** Hard-delete every expired room. Returns the purged room ids. */
export function purgeExpiredRooms(now = new Date()): string[] {
  const ids = purgeExpiredTx(now.toISOString()) as string[];
  for (const id of ids) chatsHub.disconnectChannel(id);
  return ids;
}

/** If the room is past expiry, wipe it and return true. */
export function purgeIfExpired(room: ChatRoomRow | undefined, now = new Date()): boolean {
  if (!room || !isExpired(room, now)) return false;
  purgeRoom(room.id);
  return true;
}
