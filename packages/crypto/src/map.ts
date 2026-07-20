import {
  base64UrlToBytes,
  bytesToBase64Url,
} from "./binary.js";
import {
  decryptSecretPayload,
  encryptSecretPayload,
  generateSecretKey,
} from "./aes-gcm.js";

export type MapRevealPayload = {
  message?: string;
  legacy?: boolean;
  ciphertext?: string;
  nonce?: string;
  key?: string;
};

/** Encrypt a map-drop message (AES-256-GCM) for server storage. */
export function encryptMapMessage(text: string): {
  ciphertext: string;
  nonce: string;
  key: string;
} {
  const { keyBase64, rawKey } = generateSecretKey();
  const { ciphertext, nonce } = encryptSecretPayload(new TextEncoder().encode(text), rawKey);
  return {
    ciphertext: bytesToBase64Url(ciphertext),
    nonce,
    key: keyBase64,
  };
}

/** Resolve a map /reveal response into plaintext. */
export function decryptMapReveal(data: MapRevealPayload): string {
  if (data.message != null && (data.legacy || !data.ciphertext)) {
    return data.message;
  }
  if (!data.ciphertext || !data.nonce || !data.key) {
    throw new Error("Missing encrypted map payload");
  }
  const rawKey = base64UrlToBytes(data.key);
  const ciphertext = base64UrlToBytes(data.ciphertext);
  const plaintext = decryptSecretPayload(ciphertext, data.nonce, rawKey);
  return new TextDecoder().decode(plaintext);
}
