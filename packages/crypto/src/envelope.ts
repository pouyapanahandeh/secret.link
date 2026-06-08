import sodium from "libsodium-wrappers-sumo";

let initialized = false;

async function ensureInit(): Promise<void> {
  if (!initialized) {
    await sodium.ready;
    initialized = true;
  }
}

/**
 * Generate a random Data Encryption Key (DEK) — 256 bits.
 */
export async function generateDEK(): Promise<Uint8Array> {
  await ensureInit();
  return sodium.randombytes_buf(32);
}

/**
 * Wrap (encrypt) a DEK with a Key Encryption Key (KEK).
 * Uses XChaCha20-Poly1305.
 */
export async function wrapDEK(dek: Uint8Array, kek: Uint8Array): Promise<{ wrapped: string; nonce: string }> {
  await ensureInit();

  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const wrapped = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(dek, null, null, nonce, kek);

  return {
    wrapped: sodium.to_base64(wrapped, sodium.base64_variants.URLSAFE_NO_PADDING),
    nonce: sodium.to_base64(nonce, sodium.base64_variants.URLSAFE_NO_PADDING),
  };
}

/**
 * Unwrap (decrypt) a DEK with a Key Encryption Key (KEK).
 */
export async function unwrapDEK(wrapped: string, nonce: string, kek: Uint8Array): Promise<Uint8Array> {
  await ensureInit();

  const wrappedBytes = sodium.from_base64(wrapped, sodium.base64_variants.URLSAFE_NO_PADDING);
  const nonceBytes = sodium.from_base64(nonce, sodium.base64_variants.URLSAFE_NO_PADDING);

  return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, wrappedBytes, null, nonceBytes, kek);
}
