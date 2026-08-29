import { describe, it, expect } from "vitest";
import db from "../src/db.js";
import {
  mintRecoveryCodes,
  consumeRecoveryCode,
  countUnusedRecoveryCodes,
} from "../src/lib/recovery-codes.js";

function insertUser(handle: string): string {
  const id = `u_${Math.random().toString(36).slice(2, 12)}`;
  db.prepare(
    `INSERT INTO users (id, handle, email, is_pro, created_at) VALUES (?, ?, NULL, 0, ?)`,
  ).run(id, handle, new Date().toISOString());
  return id;
}

describe("consumeRecoveryCode", () => {
  it("returns false when the user has no unused codes", () => {
    const userId = insertUser(`none${Date.now().toString(36)}`);
    expect(countUnusedRecoveryCodes(userId)).toBe(0);
    expect(consumeRecoveryCode(userId, "AAAA-BBBB")).toBe(false);
    expect(countUnusedRecoveryCodes(userId)).toBe(0);
  });

  it("consumes exactly one matching unused code and rejects padding as a match", () => {
    const userId = insertUser(`pad${Date.now().toString(36)}`);
    const codes = mintRecoveryCodes(userId);
    expect(codes).toHaveLength(10);
    expect(countUnusedRecoveryCodes(userId)).toBe(10);

    expect(consumeRecoveryCode(userId, codes[0]!)).toBe(true);
    expect(countUnusedRecoveryCodes(userId)).toBe(9);
    expect(consumeRecoveryCode(userId, codes[0]!)).toBe(false);
    expect(countUnusedRecoveryCodes(userId)).toBe(9);

    expect(consumeRecoveryCode(userId, "PAD22XXXX")).toBe(false);
    expect(consumeRecoveryCode(userId, "PAD2-XXXX")).toBe(false);
    expect(countUnusedRecoveryCodes(userId)).toBe(9);
  });
});
