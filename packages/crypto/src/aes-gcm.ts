import sodium from "libsodium-wrappers-sumo";

let initialized = false;

async function ensureInit(): Promise<void> {
  if (!initialized) {
    await sodium.ready;
    initialized = true;
  }
}

export type EncryptedPayload = {
  readonly ciphertext: string; // base64
  readonly nonce: string; // base64
};

/**
 * Encrypt plaintext with AES-256-GCM using a 256-bit key.
 * Uses libsodium's AEAD construction.
 */
export async function encrypt(plaintext: string, key: Uint8Array): Promise<EncryptedPayload> {
  await ensureInit();

  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const encoded = sodium.from_string(plaintext);

  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    encoded,
    null,
    null,
    nonce,
    key,
  );

  return {
    ciphertext: sodium.to_base64(ciphertext, sodium.base64_variants.URLSAFE_NO_PADDING),
    nonce: sodium.to_base64(nonce, sodium.base64_variants.URLSAFE_NO_PADDING),
  };
}

/**
 * Decrypt ciphertext with the same key and nonce used during encryption.
 */
export async function decrypt(payload: EncryptedPayload, key: Uint8Array): Promise<string> {
  await ensureInit();

  const ciphertext = sodium.from_base64(
    payload.ciphertext,
    sodium.base64_variants.URLSAFE_NO_PADDING,
  );
  const nonce = sodium.from_base64(payload.nonce, sodium.base64_variants.URLSAFE_NO_PADDING);

  const decrypted = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    ciphertext,
    null,
    nonce,
    key,
  );

  return sodium.to_string(decrypted);
}
