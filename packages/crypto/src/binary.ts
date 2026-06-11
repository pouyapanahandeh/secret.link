import sodium from "libsodium-wrappers-sumo";

let initialized = false;

async function ensureInit(): Promise<void> {
  if (!initialized) {
    await sodium.ready;
    initialized = true;
  }
}

export type EncryptedBlob = {
  readonly ciphertext: Uint8Array;
  readonly nonce: string; // base64url
};

/**
 * Encrypt binary data (files, images, video) with XChaCha20-Poly1305.
 */
export async function encryptBlob(data: Uint8Array, key: Uint8Array): Promise<EncryptedBlob> {
  await ensureInit();

  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    data,
    null,
    null,
    nonce,
    key,
  );

  return {
    ciphertext,
    nonce: sodium.to_base64(nonce, sodium.base64_variants.URLSAFE_NO_PADDING),
  };
}

/**
 * Decrypt binary data.
 */
export async function decryptBlob(ciphertext: Uint8Array, nonce: string, key: Uint8Array): Promise<Uint8Array> {
  await ensureInit();

  const nonceBytes = sodium.from_base64(nonce, sodium.base64_variants.URLSAFE_NO_PADDING);

  return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    ciphertext,
    null,
    nonceBytes,
    key,
  );
}

/**
 * Generate a random 256-bit key and return it as base64url (for URL fragment).
 */
export async function generateKeyBase64(): Promise<{ key: Uint8Array; keyBase64: string }> {
  await ensureInit();
  const key = sodium.randombytes_buf(32);
  const keyBase64 = sodium.to_base64(key, sodium.base64_variants.URLSAFE_NO_PADDING);
  return { key, keyBase64 };
}

/**
 * Decode a base64url key string back to Uint8Array.
 */
export async function keyFromBase64(keyBase64: string): Promise<Uint8Array> {
  await ensureInit();
  return sodium.from_base64(keyBase64, sodium.base64_variants.URLSAFE_NO_PADDING);
}
