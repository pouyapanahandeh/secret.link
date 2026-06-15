/**
 * Browser-native encryption using Web Crypto API (AES-256-GCM).
 * No WASM, no dependencies — works everywhere.
 */

export async function generateKeyBase64(): Promise<{ key: CryptoKey; keyBase64: string }> {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const keyBase64 = uint8ToBase64Url(rawKey);
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
  return { key, keyBase64 };
}

export async function keyFromBase64(keyBase64: string): Promise<CryptoKey> {
  const rawKey = base64UrlToUint8(keyBase64);
  return crypto.subtle.importKey("raw", rawKey as BufferSource, "AES-GCM", false, ["decrypt"]);
}

export async function encryptBlob(
  data: Uint8Array,
  key: CryptoKey,
): Promise<{ ciphertext: Uint8Array; nonce: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data as BufferSource);
  return {
    ciphertext: new Uint8Array(encrypted),
    nonce: uint8ToBase64Url(iv),
  };
}

export async function decryptBlob(
  ciphertext: Uint8Array,
  nonce: string,
  key: CryptoKey,
): Promise<Uint8Array> {
  const iv = base64UrlToUint8(nonce);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ciphertext as BufferSource);
  return new Uint8Array(decrypted);
}

// --- Base64url helpers (no padding) ---

function uint8ToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToUint8(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
