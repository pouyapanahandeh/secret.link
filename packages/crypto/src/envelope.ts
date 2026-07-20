import { encryptAesGcm, decryptAesGcm } from "./aes-gcm.js";
import { bytesToBase64Url, base64UrlToBytes, randomBytes } from "./binary.js";

/** Generate a random Data Encryption Key (DEK) — 256 bits. */
export function generateDEK(): Uint8Array {
  return randomBytes(32);
}

/** Wrap (encrypt) a DEK with a Key Encryption Key (KEK) using AES-256-GCM. */
export function wrapDEK(dek: Uint8Array, kek: Uint8Array): { wrapped: string; nonce: string } {
  const { ciphertext, iv } = encryptAesGcm(dek, kek);
  return {
    wrapped: bytesToBase64Url(ciphertext),
    nonce: bytesToBase64Url(iv),
  };
}

/** Unwrap (decrypt) a DEK with a Key Encryption Key (KEK). */
export function unwrapDEK(wrapped: string, nonce: string, kek: Uint8Array): Uint8Array {
  const wrappedBytes = base64UrlToBytes(wrapped);
  const iv = base64UrlToBytes(nonce);
  return decryptAesGcm(wrappedBytes, kek, iv);
}
