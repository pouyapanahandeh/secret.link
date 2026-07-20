import { gcm } from "@noble/ciphers/aes";
import { AES_GCM_IV_BYTES, AES_KEY_BYTES } from "./protocol.js";
import {
  base64UrlToBytes,
  bytesToBase64Url,
  randomBytes,
  type EncryptedBlob,
} from "./binary.js";

export function encryptAesGcm(
  data: Uint8Array,
  rawKey: Uint8Array,
  iv?: Uint8Array,
): { ciphertext: Uint8Array; iv: Uint8Array } {
  if (rawKey.length !== AES_KEY_BYTES) {
    throw new Error(`AES key must be ${AES_KEY_BYTES} bytes`);
  }
  const nonce = iv ?? randomBytes(AES_GCM_IV_BYTES);
  const aes = gcm(rawKey, nonce);
  return { ciphertext: aes.encrypt(data), iv: nonce };
}

export function decryptAesGcm(ciphertext: Uint8Array, rawKey: Uint8Array, iv: Uint8Array): Uint8Array {
  const aes = gcm(rawKey, iv);
  return aes.decrypt(ciphertext);
}

export function generateSecretKey(): { keyBase64: string; rawKey: Uint8Array } {
  const rawKey = randomBytes(AES_KEY_BYTES);
  return { keyBase64: bytesToBase64Url(rawKey), rawKey };
}

export function encryptSecretPayload(
  data: Uint8Array,
  rawKey: Uint8Array,
): EncryptedBlob {
  const { ciphertext, iv } = encryptAesGcm(data, rawKey);
  return { ciphertext, nonce: bytesToBase64Url(iv) };
}

export function decryptSecretPayload(
  ciphertext: Uint8Array,
  nonce: string,
  rawKey: Uint8Array,
): Uint8Array {
  const iv = base64UrlToBytes(nonce);
  return decryptAesGcm(ciphertext, rawKey, iv);
}

/** Legacy string encrypt/decrypt helpers (server-side envelope tests). */
export type EncryptedPayload = {
  readonly ciphertext: string;
  readonly nonce: string;
};

export function encryptString(plaintext: string, key: Uint8Array): EncryptedPayload {
  const { ciphertext, iv } = encryptAesGcm(new TextEncoder().encode(plaintext), key);
  return {
    ciphertext: bytesToBase64Url(ciphertext),
    nonce: bytesToBase64Url(iv),
  };
}

export function decryptString(payload: EncryptedPayload, key: Uint8Array): string {
  const plaintext = decryptSecretPayload(base64UrlToBytes(payload.ciphertext), payload.nonce, key);
  return new TextDecoder().decode(plaintext);
}

export async function generateKeyBase64(): Promise<{ key: Uint8Array; keyBase64: string }> {
  const { keyBase64, rawKey } = generateSecretKey();
  return { key: rawKey, keyBase64 };
}

export async function keyFromBase64(keyBase64: string): Promise<Uint8Array> {
  return base64UrlToBytes(keyBase64);
}

export async function encryptBlob(data: Uint8Array, key: Uint8Array): Promise<EncryptedBlob> {
  return encryptSecretPayload(data, key);
}

export async function decryptBlob(
  ciphertext: Uint8Array,
  nonce: string,
  key: Uint8Array,
): Promise<Uint8Array> {
  return decryptSecretPayload(ciphertext, nonce, key);
}
