/**
 * DM end-to-end encryption using X25519 key exchange + AES-256-GCM.
 * Keys are stored in IndexedDB for persistence across sessions.
 */

export interface WrappedKey {
  wrappedKey: string;
  wrapNonce: string;
  wrapEpk: string;
}

// ─── IndexedDB Key Storage ──────────────────────────────────────────────────

const IDB_NAME = "sl_crypto";
const IDB_STORE = "keys";

function openKeyStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface StoredKeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicKeyB64: string;
}

export async function getStoredKeyPair(): Promise<StoredKeyPair | null> {
  try {
    const idb = await openKeyStore();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.get("dm_keypair");
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function storeKeyPair(data: StoredKeyPair): Promise<void> {
  const idb = await openKeyStore();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const req = store.put(data, "dm_keypair");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function generateAndStoreKeyPair(): Promise<StoredKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "X25519" } as any,
    false,
    ["deriveBits"],
  );
  const pubRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const publicKeyB64 = btoa(String.fromCharCode(...new Uint8Array(pubRaw)));
  const data: StoredKeyPair = {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    publicKeyB64,
  };
  await storeKeyPair(data);
  return data;
}

export async function migrateFromLocalStorage(): Promise<StoredKeyPair | null> {
  const raw = localStorage.getItem("sl_dm_keys");
  if (!raw) return null;
  try {
    const { privateKey: privB64, publicKey: pubB64 } = JSON.parse(raw);
    const privBytes = Uint8Array.from(atob(privB64), (c) => c.charCodeAt(0));
    const pubBytes = Uint8Array.from(atob(pubB64), (c) => c.charCodeAt(0));

    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      privBytes,
      { name: "X25519" } as any,
      false,
      ["deriveBits"],
    );
    const publicKey = await crypto.subtle.importKey(
      "raw",
      pubBytes,
      { name: "X25519" } as any,
      true,
      [],
    );
    const data: StoredKeyPair = { privateKey, publicKey, publicKeyB64: pubB64 };
    await storeKeyPair(data);
    localStorage.removeItem("sl_dm_keys");
    return data;
  } catch {
    localStorage.removeItem("sl_dm_keys");
    return null;
  }
}

/**
 * Ensures we have a key pair — checks IndexedDB, migrates from localStorage, or generates new.
 */
export async function ensureKeyPair(): Promise<StoredKeyPair> {
  let kp = await getStoredKeyPair();
  if (kp) {
    // Validate that stored CryptoKey is still usable (can become stale on iOS/Safari PWA)
    try {
      await crypto.subtle.exportKey("raw", kp.publicKey);
    } catch {
      kp = null;
    }
  }
  if (!kp) kp = await migrateFromLocalStorage();
  if (!kp) kp = await generateAndStoreKeyPair();
  return kp;
}

/**
 * Ensures a local keypair exists and publishes the public key to the server.
 * Idempotent — safe to call on every app load so any user can receive
 * E2E-wrapped secrets/DMs. Returns the keypair, or null if X25519 is
 * unsupported in this browser.
 */
export async function ensureAndPublishKey(
  apiBase: string,
  token: string,
): Promise<StoredKeyPair | null> {
  try {
    const kp = await ensureKeyPair();
    await fetch(`${apiBase}/v1/dms/keys`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ publicKey: kp.publicKeyB64 }),
    });
    return kp;
  } catch {
    return null;
  }
}

// ─── Key Derivation & Encryption ────────────────────────────────────────────

export async function deriveSharedKey(
  privateKey: CryptoKey,
  publicKeyB64: string,
): Promise<CryptoKey> {
  const pubBytes = Uint8Array.from(atob(publicKeyB64), (c) => c.charCodeAt(0));
  const publicKey = await crypto.subtle.importKey(
    "raw",
    pubBytes,
    { name: "X25519" } as any,
    false,
    [],
  );
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "X25519", public: publicKey } as any,
    privateKey,
    256,
  );
  return crypto.subtle.importKey("raw", sharedBits, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptMessage(
  text: string,
  sharedKey: CryptoKey,
): Promise<{ encrypted: string; nonce: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, sharedKey, encoded);
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    nonce: btoa(String.fromCharCode(...iv)),
  };
}

export async function decryptMessage(
  encryptedB64: string,
  nonceB64: string,
  sharedKey: CryptoKey,
): Promise<string> {
  const ciphertext = Uint8Array.from(atob(encryptedB64), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(nonceB64), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, sharedKey, ciphertext);
  return new TextDecoder().decode(decrypted);
}

// ─── ECIES key wrapping (deliver a secret's AES key to a recipient) ──────────
// Used by profile-addressed secrets: instead of putting the AES key in the URL
// fragment, we wrap it for the recipient's published X25519 public key. Only
// the recipient (holding the matching private key) can unwrap it. The server
// stores opaque ciphertext and never sees the key (zero-knowledge preserved).

/** Wrap raw key bytes for a recipient using an ephemeral X25519 keypair (ECIES). */
export async function wrapKeyForRecipient(
  rawKey: Uint8Array,
  recipientPublicKeyB64: string,
): Promise<WrappedKey> {
  let pubBytes: Uint8Array;
  try {
    pubBytes = Uint8Array.from(atob(recipientPublicKeyB64.trim()), (c) => c.charCodeAt(0));
  } catch {
    throw new Error("invalid_recipient_key");
  }
  if (pubBytes.length !== 32) {
    throw new Error("invalid_recipient_key");
  }

  const ephemeral = await crypto.subtle.generateKey(
    { name: "X25519" } as any,
    false,
    ["deriveBits"],
  );
  const sharedKey = await deriveSharedKey(ephemeral.privateKey, recipientPublicKeyB64);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    rawKey as BufferSource,
  );

  const epkRaw = await crypto.subtle.exportKey("raw", ephemeral.publicKey);

  return {
    wrappedKey: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    wrapNonce: btoa(String.fromCharCode(...iv)),
    wrapEpk: btoa(String.fromCharCode(...new Uint8Array(epkRaw))),
  };
}

/** Unwrap a secret's raw key bytes using the recipient's private key. */
export async function unwrapKeyFromSender(
  wrapped: WrappedKey,
  recipientPrivateKey: CryptoKey,
): Promise<Uint8Array> {
  const sharedKey = await deriveSharedKey(recipientPrivateKey, wrapped.wrapEpk);
  const ciphertext = Uint8Array.from(atob(wrapped.wrappedKey), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(wrapped.wrapNonce), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, sharedKey, ciphertext);
  return new Uint8Array(decrypted);
}
