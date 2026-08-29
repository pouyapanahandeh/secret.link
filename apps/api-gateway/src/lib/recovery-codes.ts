import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { nanoid } from "nanoid";
import db from "../db.js";

const CODE_COUNT = 10;
const GROUP_LEN = 4;
/** Alphabet without I/O/0/1 to reduce transcription errors. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SCRYPT_KEYLEN = 32;
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 } as const;

const stmts = {
  insert: db.prepare(
    `INSERT INTO recovery_codes (id, user_id, code_hash, created_at) VALUES (?, ?, ?, ?)`,
  ),
  deleteUnused: db.prepare(`DELETE FROM recovery_codes WHERE user_id = ? AND used_at IS NULL`),
  countUnused: db.prepare(
    `SELECT COUNT(*) AS c FROM recovery_codes WHERE user_id = ? AND used_at IS NULL`,
  ),
  listUnused: db.prepare(
    `SELECT id, code_hash FROM recovery_codes WHERE user_id = ? AND used_at IS NULL`,
  ),
  markUsed: db.prepare(`UPDATE recovery_codes SET used_at = ? WHERE id = ?`),
};

function randomGroup(len: number): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length]!;
  }
  return out;
}

/** Canonical `XXXX-XXXX` form, or the compact remainder if the input is the wrong length. */
export function normalizeRecoveryCode(code: string): string {
  const compact = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length !== GROUP_LEN * 2) return compact;
  return `${compact.slice(0, GROUP_LEN)}-${compact.slice(GROUP_LEN)}`;
}

export function generatePlaintextCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < CODE_COUNT; i++) {
    codes.push(`${randomGroup(GROUP_LEN)}-${randomGroup(GROUP_LEN)}`);
  }
  return codes;
}

export function hashRecoveryCode(code: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(normalizeRecoveryCode(code), salt, SCRYPT_KEYLEN, SCRYPT_OPTS);
  return `${salt.toString("base64url")}.${hash.toString("base64url")}`;
}

export function verifyRecoveryCode(code: string, stored: string): boolean {
  const [saltB64, hashB64] = stored.split(".");
  if (!saltB64 || !hashB64) return false;
  try {
    const salt = Buffer.from(saltB64, "base64url");
    const expected = Buffer.from(hashB64, "base64url");
    const actual = scryptSync(normalizeRecoveryCode(code), salt, SCRYPT_KEYLEN, SCRYPT_OPTS);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Replace unused codes for a user and return the new plaintext set (shown once). */
export function mintRecoveryCodes(userId: string): string[] {
  const codes = generatePlaintextCodes();
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    stmts.deleteUnused.run(userId);
    for (const code of codes) {
      stmts.insert.run(nanoid(), userId, hashRecoveryCode(code), now);
    }
  });
  tx();
  return codes;
}

export function countUnusedRecoveryCodes(userId: string): number {
  const row = stmts.countUnused.get(userId) as { c: number } | undefined;
  return row?.c ?? 0;
}

let dummyHashes: string[] | null = null;

function getDummyHashes(): string[] {
  if (!dummyHashes) {
    dummyHashes = [];
    for (let i = 0; i < CODE_COUNT; i++) {
      dummyHashes.push(hashRecoveryCode(`PAD${String(i).padStart(4, "2")}-XXXX`));
    }
  }
  return dummyHashes;
}

/**
 * Always runs `CODE_COUNT` verifies. Returns the index into `realHashes` of the
 * first match, or null. Dummy hashes are never treated as a match.
 */
function verifyAgainstHashes(code: string, realHashes: string[]): number | null {
  const dummies = getDummyHashes();
  const work = realHashes.slice(0, CODE_COUNT);
  while (work.length < CODE_COUNT) {
    work.push(dummies[work.length]!);
  }
  const realCount = Math.min(realHashes.length, CODE_COUNT);
  let matched: number | null = null;
  for (let i = 0; i < CODE_COUNT; i++) {
    if (verifyRecoveryCode(code, work[i]!) && matched === null && i < realCount) {
      matched = i;
    }
  }
  return matched;
}

/**
 * Same work as a failed consume (10 scrypt verifies). Always returns false.
 * Used when the handle does not exist so timing does not leak that fact.
 */
export function stretchRecoveryCodeCheck(code: string): false {
  verifyAgainstHashes(code, []);
  return false;
}

/**
 * Mark a matching unused code as used. Always verifies against exactly
 * `CODE_COUNT` hashes (unused rows padded with dummies) so timing does not
 * leak how many unused codes remain.
 */
export function consumeRecoveryCode(userId: string, code: string): boolean {
  const rows = stmts.listUnused.all(userId) as Array<{ id: string; code_hash: string }>;
  const idx = verifyAgainstHashes(
    code,
    rows.map((row) => row.code_hash),
  );
  if (idx === null) return false;
  const matched = rows[idx];
  if (!matched) return false;
  stmts.markUsed.run(new Date().toISOString(), matched.id);
  return true;
}
