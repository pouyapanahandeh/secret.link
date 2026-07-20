import { randomBytes } from "./binary.js";

/**
 * Derive a 256-bit key from a password (test / local tooling only).
 * Production server wrapping uses MASTER_KEY via api-gateway/lib/crypto.
 */
export function deriveKey(password: string, salt?: Uint8Array): { key: Uint8Array; salt: Uint8Array } {
  const actualSalt = salt ?? randomBytes(16);
  const data = new TextEncoder().encode(`${password}:${bytesToHex(actualSalt)}`);
  // Simple deterministic stretch for tests — not a production KDF.
  let key = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    key[i] = data[i % data.length]! ^ actualSalt[i % actualSalt.length]!;
  }
  return { key, salt: actualSalt };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
