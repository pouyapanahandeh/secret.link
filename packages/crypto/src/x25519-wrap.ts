import { gcm } from "@noble/ciphers/aes";
import { x25519 } from "@noble/curves/ed25519";
import { base64ToBytes, bytesToBase64, randomBytes } from "./binary.js";
import { AES_GCM_IV_BYTES } from "./protocol.js";

export interface WrappedKey {
  wrappedKey: string;
  wrapNonce: string;
  wrapEpk: string;
}

function deriveSharedAesKey(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  const shared = x25519.getSharedSecret(privateKey, publicKey);
  return shared.slice(0, 32);
}

/** Wrap a raw AES key for the recipient's published X25519 public key (standard base64 fields). */
export function wrapKeyForRecipient(rawKey: Uint8Array, recipientPublicKeyB64: string): WrappedKey {
  const recipientPublicKey = base64ToBytes(recipientPublicKeyB64);
  const ephemeralPrivate = randomBytes(32);
  const ephemeralPublic = x25519.getPublicKey(ephemeralPrivate);

  const sharedKey = deriveSharedAesKey(ephemeralPrivate, recipientPublicKey);
  const iv = randomBytes(AES_GCM_IV_BYTES);
  const aes = gcm(sharedKey, iv);
  const wrapped = aes.encrypt(rawKey);

  return {
    wrappedKey: bytesToBase64(wrapped),
    wrapNonce: bytesToBase64(iv),
    wrapEpk: bytesToBase64(ephemeralPublic),
  };
}

/** Unwrap a secret's raw key bytes using the recipient's X25519 private key. */
export function unwrapKeyFromSender(wrapped: WrappedKey, recipientPrivateKey: Uint8Array): Uint8Array {
  const ephemeralPublic = base64ToBytes(wrapped.wrapEpk);
  const sharedKey = deriveSharedAesKey(recipientPrivateKey, ephemeralPublic);
  const iv = base64ToBytes(wrapped.wrapNonce);
  const ciphertext = base64ToBytes(wrapped.wrappedKey);
  const aes = gcm(sharedKey, iv);
  return aes.decrypt(ciphertext);
}

/** Deterministic wrap using fixed ephemeral keys (test vectors only). */
export function wrapKeyForRecipientWithKeys(
  rawKey: Uint8Array,
  recipientPublicKey: Uint8Array,
  ephemeralPrivate: Uint8Array,
): WrappedKey {
  const ephemeralPublic = x25519.getPublicKey(ephemeralPrivate);
  const sharedKey = deriveSharedAesKey(ephemeralPrivate, recipientPublicKey);
  const iv = randomBytes(AES_GCM_IV_BYTES);
  const aes = gcm(sharedKey, iv);
  const wrapped = aes.encrypt(rawKey);
  return {
    wrappedKey: bytesToBase64(wrapped),
    wrapNonce: bytesToBase64(iv),
    wrapEpk: bytesToBase64(ephemeralPublic),
  };
}

export { x25519 };
