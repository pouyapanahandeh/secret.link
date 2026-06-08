import sodium from "libsodium-wrappers-sumo";

let initialized = false;

async function ensureInit(): Promise<void> {
  if (!initialized) {
    await sodium.ready;
    initialized = true;
  }
}

/**
 * Derive a 256-bit key from a password using Argon2id.
 */
export async function deriveKey(password: string, salt?: Uint8Array): Promise<{ key: Uint8Array; salt: Uint8Array }> {
  await ensureInit();

  const actualSalt = salt ?? sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);

  const key = sodium.crypto_pwhash(
    32,
    password,
    actualSalt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );

  return { key, salt: actualSalt };
}
