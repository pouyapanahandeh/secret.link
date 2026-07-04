import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Server-side symmetric encryption for data-at-rest that the server must be
// able to read back (IVS stream keys, wrapped DEKs). This is NOT the end-to-end
// user encryption — that stays client-side. This only protects secrets stored
// in SQLite so a database leak alone does not expose broadcast credentials.

const ALGO = "aes-256-gcm";

function getMasterKey(): Buffer {
  const raw = process.env["MASTER_KEY"];
  if (!raw) {
    if (process.env["NODE_ENV"] === "production") {
      throw new Error("MASTER_KEY must be set in production");
    }
    // Deterministic, clearly-insecure dev fallback so local/test runs work.
    return Buffer.alloc(32, 7);
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("MASTER_KEY must decode to 32 bytes (base64-encoded)");
  }
  return key;
}

let cachedKey: Buffer | null = null;
function key(): Buffer {
  return (cachedKey ??= getMasterKey());
}

/** Encrypt a UTF-8 string. Returns a self-contained "v1:iv:tag:ct" token. */
export function encryptString(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

/** Decrypt a token produced by encryptString. Returns null on any failure. */
export function decryptString(token: string): string | null {
  try {
    const [version, ivB64, tagB64, ctB64] = token.split(":");
    if (version !== "v1" || !ivB64 || !tagB64 || !ctB64) return null;
    const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const pt = Buffer.concat([
      decipher.update(Buffer.from(ctB64, "base64")),
      decipher.final(),
    ]);
    return pt.toString("utf8");
  } catch {
    return null;
  }
}

/** Wrap a raw data-encryption key (bytes) into an opaque string for storage. */
export function wrapKey(dek: Uint8Array): string {
  return encryptString(Buffer.from(dek).toString("base64"));
}
