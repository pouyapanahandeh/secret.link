import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_KEYLEN = 32;
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 } as const;

/** Hash a chat PIN for storage. Never log `pin`. */
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, SCRYPT_KEYLEN, SCRYPT_OPTS);
  return `${salt.toString("base64url")}.${hash.toString("base64url")}`;
}

/** Timing-safe PIN check against a stored scrypt hash. */
export function verifyPin(pin: string, stored: string): boolean {
  const [saltB64, hashB64] = stored.split(".");
  if (!saltB64 || !hashB64) return false;
  try {
    const salt = Buffer.from(saltB64, "base64url");
    const expected = Buffer.from(hashB64, "base64url");
    const actual = scryptSync(pin, salt, SCRYPT_KEYLEN, SCRYPT_OPTS);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Constant-ish delay so PIN success/failure is not a cheap timing oracle. */
export function pinDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 80));
}
