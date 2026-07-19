/**
 * Profile-addressed secret encryption — matches the web client's AES-256-GCM +
 * X25519 ECIES key wrapping so recipients can decrypt on any platform.
 */
import { gcm } from "@noble/ciphers/aes";
import { x25519 } from "@noble/curves/ed25519";
import { getRandomBytes } from "expo-crypto";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlToBytes(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return base64ToBytes(padded);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function generateSecretKey(): Promise<{
  keyBase64: string;
  rawKey: Uint8Array;
}> {
  const rawKey = getRandomBytes(32);
  return { keyBase64: bytesToBase64Url(rawKey), rawKey };
}

export function encryptSecretPayload(
  data: Uint8Array,
  rawKey: Uint8Array,
): { ciphertext: Uint8Array; nonce: string } {
  const iv = getRandomBytes(12);
  const aes = gcm(rawKey, iv);
  const ciphertext = aes.encrypt(data);
  return { ciphertext, nonce: bytesToBase64Url(iv) };
}

export interface WrappedKey {
  wrappedKey: string;
  wrapNonce: string;
  wrapEpk: string;
}

function deriveSharedAesKey(
  privateKey: Uint8Array,
  publicKey: Uint8Array,
): Uint8Array {
  const shared = x25519.getSharedSecret(privateKey, publicKey);
  return shared.slice(0, 32);
}

/** Wrap a raw AES key for the recipient's published X25519 public key. */
export function wrapKeyForRecipient(
  rawKey: Uint8Array,
  recipientPublicKeyB64: string,
): WrappedKey {
  const recipientPublicKey = base64ToBytes(recipientPublicKeyB64);
  const ephemeralPrivate = getRandomBytes(32);
  const ephemeralPublic = x25519.getPublicKey(ephemeralPrivate);

  const sharedKey = deriveSharedAesKey(ephemeralPrivate, recipientPublicKey);
  const iv = getRandomBytes(12);
  const aes = gcm(sharedKey, iv);
  const wrapped = aes.encrypt(rawKey);

  return {
    wrappedKey: bytesToBase64(wrapped),
    wrapNonce: bytesToBase64(iv),
    wrapEpk: bytesToBase64(ephemeralPublic),
  };
}

export function encodeCiphertextBase64(ciphertext: Uint8Array): string {
  return bytesToBase64(ciphertext);
}

/** Encrypt a map-drop message (AES-256-GCM) for server storage. */
export function encryptMapMessage(text: string): {
  ciphertext: string;
  nonce: string;
  key: string;
} {
  const { keyBase64, rawKey } = (() => {
    const rawKey = getRandomBytes(32);
    return { keyBase64: bytesToBase64Url(rawKey), rawKey };
  })();
  const { ciphertext, nonce } = encryptSecretPayload(new TextEncoder().encode(text), rawKey);
  return {
    ciphertext: bytesToBase64Url(ciphertext),
    nonce,
    key: keyBase64,
  };
}

/** Resolve a map /reveal response into plaintext. */
export function decryptMapReveal(data: {
  message?: string;
  legacy?: boolean;
  ciphertext?: string;
  nonce?: string;
  key?: string;
}): string {
  if (data.message != null && (data.legacy || !data.ciphertext)) {
    return data.message;
  }
  if (!data.ciphertext || !data.nonce || !data.key) {
    throw new Error("Missing encrypted map payload");
  }
  const rawKey = base64UrlToBytes(data.key);
  const iv = base64UrlToBytes(data.nonce);
  const ciphertext = base64UrlToBytes(data.ciphertext);
  const aes = gcm(rawKey, iv);
  return new TextDecoder().decode(aes.decrypt(ciphertext));
}

export { base64UrlToBytes, bytesToBase64Url };
