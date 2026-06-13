/**
 * E2E encryption helpers for DMs.
 *
 * Uses X25519 ECDH key agreement + XSalsa20-Poly1305 (NaCl box).
 * Compatible with the web client's SubtleCrypto-based approach
 * (both use X25519 for key exchange + authenticated encryption).
 *
 * Keys are stored in expo-secure-store.
 */
import * as SecureStore from "expo-secure-store";
import nacl from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";

const KEY_PRIVATE = "sl_dm_private_key";
const KEY_PUBLIC = "sl_dm_public_key";

// ─── Key Management ─────────────────────────────────────────────────────────

export async function getOrCreateKeyPair(): Promise<{
  publicKey: string;
  privateKey: Uint8Array;
}> {
  const existingPriv = await SecureStore.getItemAsync(KEY_PRIVATE);
  const existingPub = await SecureStore.getItemAsync(KEY_PUBLIC);

  if (existingPriv && existingPub) {
    return {
      publicKey: existingPub,
      privateKey: decodeBase64(existingPriv),
    };
  }

  // Generate new keypair
  const keyPair = nacl.box.keyPair();
  const pubB64 = encodeBase64(keyPair.publicKey);
  const privB64 = encodeBase64(keyPair.secretKey);

  await SecureStore.setItemAsync(KEY_PRIVATE, privB64);
  await SecureStore.setItemAsync(KEY_PUBLIC, pubB64);

  return { publicKey: pubB64, privateKey: keyPair.secretKey };
}

export async function getPublicKey(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_PUBLIC);
}

// ─── Encryption ─────────────────────────────────────────────────────────────

export function encryptMessage(
  plaintext: string,
  myPrivateKey: Uint8Array,
  theirPublicKeyB64: string,
): { encryptedContent: string; nonce: string } {
  const theirPublicKey = decodeBase64(theirPublicKeyB64);
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageUint8 = new TextEncoder().encode(plaintext);

  const encrypted = nacl.box(messageUint8, nonce, theirPublicKey, myPrivateKey);
  if (!encrypted) throw new Error("Encryption failed");

  return {
    encryptedContent: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

// ─── Decryption ─────────────────────────────────────────────────────────────

export function decryptMessage(
  encryptedContentB64: string,
  nonceB64: string,
  myPrivateKey: Uint8Array,
  theirPublicKeyB64: string,
): string | null {
  try {
    const theirPublicKey = decodeBase64(theirPublicKeyB64);
    const nonce = decodeBase64(nonceB64);
    const encrypted = decodeBase64(encryptedContentB64);

    const decrypted = nacl.box.open(encrypted, nonce, theirPublicKey, myPrivateKey);
    if (!decrypted) return null;

    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}
