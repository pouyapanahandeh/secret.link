/**
 * Browser crypto adapter — delegates map/secret payload crypto to @secretlink/crypto.
 * Web Crypto CryptoKey helpers remain for blob encrypt/decrypt in the browser.
 */
import {
  decryptMapReveal as decryptMapRevealCore,
  encryptMapMessage as encryptMapMessageCore,
  generateSecretKey,
  encryptSecretPayload,
  decryptSecretPayload,
  bytesToBase64Url,
  base64UrlToBytes,
} from "@secretlink/crypto";

export async function generateKeyBase64(): Promise<{ key: CryptoKey; keyBase64: string; rawKey: Uint8Array }> {
  const { keyBase64, rawKey } = generateSecretKey();
  const key = await crypto.subtle.importKey("raw", rawKey as BufferSource, "AES-GCM", false, ["encrypt"]);
  return { key, keyBase64, rawKey };
}

export async function keyFromBase64(keyBase64: string): Promise<CryptoKey> {
  const rawKey = base64UrlToBytes(keyBase64);
  return crypto.subtle.importKey("raw", rawKey as BufferSource, "AES-GCM", false, ["decrypt"]);
}

export async function keyFromRawBytes(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", rawKey as BufferSource, "AES-GCM", false, ["decrypt"]);
}

export async function encryptBlob(
  data: Uint8Array,
  key: CryptoKey,
): Promise<{ ciphertext: Uint8Array; nonce: string }> {
  const rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  const { ciphertext, nonce } = encryptSecretPayload(data, rawKey);
  return { ciphertext, nonce };
}

export async function decryptBlob(
  ciphertext: Uint8Array,
  nonce: string,
  key: CryptoKey,
): Promise<Uint8Array> {
  const rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  return decryptSecretPayload(ciphertext, nonce, rawKey);
}

export async function encryptMapMessage(text: string): Promise<{
  ciphertext: string;
  nonce: string;
  key: string;
}> {
  return encryptMapMessageCore(text);
}

export async function decryptMapReveal(data: {
  message?: string;
  legacy?: boolean;
  ciphertext?: string;
  nonce?: string;
  key?: string;
}): Promise<string> {
  return decryptMapRevealCore(data);
}

export { bytesToBase64Url as uint8ToBase64Url, base64UrlToBytes };
