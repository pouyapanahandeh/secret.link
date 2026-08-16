/**
 * Device-local E2E keys for inbox secrets and DMs.
 * Inbox wrap/unwrap uses @secretlink/crypto (noble) when raw seeds are available,
 * and falls back to WebCrypto for legacy non-extractable CryptoKeys in IndexedDB.
 */

import {
  wrapKeyForRecipient as wrapKeyNoble,
  unwrapKeyFromSender as unwrapKeyNoble,
  unwrapKeyFromAnyWrap as unwrapKeyAnyNoble,
  wrapKeyForRecipients as wrapKeysNoble,
  x25519,
  type WrappedKey as NobleWrappedKey,
} from "@secretlink/crypto";

export type WrappedKey = NobleWrappedKey;

// ─── IndexedDB Key Storage ──────────────────────────────────────────────────

const IDB_NAME = "sl_crypto";
const IDB_STORE = "keys";
const IDB_KEY = "dm_device_key";
const LEGACY_IDB_KEY = "dm_keypair";
const LEGACY_DEVICE_ID = "legacy";

interface DeviceKeyRecord {
  deviceId: string;
  privateKeyB64: string;
  publicKeyB64: string;
}

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

async function idbGet(key: string): Promise<unknown> {
  const idb = await openKeyStore();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const idb = await openKeyStore();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const idb = await openKeyStore();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function bytesToB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** PKCS8 envelope for a 32-byte X25519 seed (RFC 8410). */
function x25519PrivateToPkcs8(raw: Uint8Array): Uint8Array {
  const prefix = new Uint8Array([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20,
  ]);
  const out = new Uint8Array(prefix.length + raw.length);
  out.set(prefix, 0);
  out.set(raw, prefix.length);
  return out;
}

async function importPrivateCryptoKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    x25519PrivateToPkcs8(raw) as BufferSource,
    { name: "X25519" } as AlgorithmIdentifier,
    false,
    ["deriveBits"],
  );
}

async function importPublicCryptoKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    raw as BufferSource,
    { name: "X25519" } as AlgorithmIdentifier,
    true,
    [],
  );
}

/** In-memory keypair used by DMs (CryptoKey) and inbox unwrap (raw bytes when available). */
export interface StoredKeyPair {
  deviceId: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicKeyB64: string;
  /** 32-byte X25519 seed when available; null for legacy non-extractable CryptoKeys. */
  privateKeyBytes: Uint8Array | null;
}

async function recordToStoredKeyPair(record: DeviceKeyRecord): Promise<StoredKeyPair> {
  const priv = b64ToBytes(record.privateKeyB64);
  if (priv.length !== 32) {
    throw new Error("invalid_private_key_length");
  }
  const pub = b64ToBytes(record.publicKeyB64);
  return {
    deviceId: record.deviceId,
    privateKeyBytes: priv,
    privateKey: await importPrivateCryptoKey(priv),
    publicKey: await importPublicCryptoKey(pub),
    publicKeyB64: record.publicKeyB64,
  };
}

async function readDeviceRecord(): Promise<DeviceKeyRecord | null> {
  try {
    const raw = await idbGet(IDB_KEY);
    if (
      raw &&
      typeof raw === "object" &&
      "deviceId" in raw &&
      "privateKeyB64" in raw &&
      "publicKeyB64" in raw
    ) {
      const rec = raw as DeviceKeyRecord;
      if (rec.deviceId && rec.privateKeyB64 && rec.publicKeyB64) return rec;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeDeviceRecord(record: DeviceKeyRecord): Promise<void> {
  await idbPut(IDB_KEY, record);
}

export async function getStoredKeyPair(): Promise<StoredKeyPair | null> {
  const record = await readDeviceRecord();
  if (!record) return null;
  try {
    return await recordToStoredKeyPair(record);
  } catch {
    return null;
  }
}

export async function storeKeyPair(data: StoredKeyPair): Promise<void> {
  if (!data.privateKeyBytes || data.privateKeyBytes.length !== 32) {
    throw new Error("cannot_persist_without_raw_private_key");
  }
  await writeDeviceRecord({
    deviceId: data.deviceId,
    privateKeyB64: bytesToB64(data.privateKeyBytes),
    publicKeyB64: data.publicKeyB64,
  });
}

export async function generateAndStoreKeyPair(): Promise<StoredKeyPair> {
  const privateKeyBytes = crypto.getRandomValues(new Uint8Array(32));
  const publicKeyBytes = x25519.getPublicKey(privateKeyBytes);
  const record: DeviceKeyRecord = {
    deviceId: crypto.randomUUID(),
    privateKeyB64: bytesToB64(privateKeyBytes),
    publicKeyB64: bytesToB64(publicKeyBytes),
  };
  await writeDeviceRecord(record);
  return recordToStoredKeyPair(record);
}

/** Migrate legacy localStorage `{ privateKey, publicKey }` base64 seeds. */
export async function migrateFromLocalStorage(): Promise<StoredKeyPair | null> {
  const raw = localStorage.getItem("sl_dm_keys");
  if (!raw) return null;
  try {
    const { privateKey: privB64, publicKey: pubB64 } = JSON.parse(raw);
    if (typeof privB64 !== "string" || typeof pubB64 !== "string") {
      localStorage.removeItem("sl_dm_keys");
      return null;
    }
    const priv = b64ToBytes(privB64);
    if (priv.length !== 32) {
      localStorage.removeItem("sl_dm_keys");
      return null;
    }
    const publicKeyB64 = bytesToB64(x25519.getPublicKey(priv));
    const record: DeviceKeyRecord = {
      deviceId: crypto.randomUUID(),
      privateKeyB64: bytesToB64(priv),
      publicKeyB64: publicKeyB64 || pubB64,
    };
    await writeDeviceRecord(record);
    localStorage.removeItem("sl_dm_keys");
    return recordToStoredKeyPair(record);
  } catch {
    localStorage.removeItem("sl_dm_keys");
    return null;
  }
}

type LegacyCryptoRecord = {
  publicKey: CryptoKey;
  publicKeyB64: string;
  privateKey: CryptoKey;
};

async function readLegacyCryptoRecord(): Promise<LegacyCryptoRecord | null> {
  try {
    const legacy = await idbGet(LEGACY_IDB_KEY);
    if (!legacy || typeof legacy !== "object") return null;
    const obj = legacy as {
      publicKey?: CryptoKey;
      publicKeyB64?: string;
      privateKey?: CryptoKey;
    };
    if (!obj.publicKeyB64 || !obj.privateKey || !obj.publicKey) return null;
    return {
      publicKey: obj.publicKey,
      publicKeyB64: obj.publicKeyB64,
      privateKey: obj.privateKey,
    };
  } catch {
    return null;
  }
}

function legacyRecordToStoredKeyPair(obj: LegacyCryptoRecord): StoredKeyPair {
  return {
    deviceId: LEGACY_DEVICE_ID,
    privateKey: obj.privateKey,
    publicKey: obj.publicKey,
    publicKeyB64: obj.publicKeyB64,
    privateKeyBytes: null,
  };
}

/**
 * Load legacy CryptoKey pair from IDB.
 * Never deletes unreadable keys — they are still required to open older wraps.
 * Only migrates into dm_device_key when no modern device record exists yet.
 */
async function loadLegacyCryptoKeyPair(): Promise<StoredKeyPair | null> {
  const obj = await readLegacyCryptoRecord();
  if (!obj) return null;

  const existingModern = await readDeviceRecord();
  if (!existingModern) {
    // Best-effort migrate to raw seed when extractable AND pub matches.
    try {
      const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", obj.privateKey));
      if (pkcs8.length >= 32) {
        const privateKeyBytes = pkcs8.slice(pkcs8.length - 32);
        const derivedPub = bytesToB64(x25519.getPublicKey(privateKeyBytes));
        if (derivedPub === obj.publicKeyB64) {
          const record: DeviceKeyRecord = {
            deviceId: crypto.randomUUID(),
            privateKeyB64: bytesToB64(privateKeyBytes),
            publicKeyB64: obj.publicKeyB64,
          };
          await writeDeviceRecord(record);
          await idbDelete(LEGACY_IDB_KEY);
          return recordToStoredKeyPair(record);
        }
      }
    } catch {
      /* non-extractable or mismatched — keep CryptoKey */
    }
  }

  return legacyRecordToStoredKeyPair(obj);
}

/** Load existing device key including legacy migrations — never generates. */
export async function loadExistingKeyPair(): Promise<StoredKeyPair | null> {
  let kp = await getStoredKeyPair();
  if (!kp) kp = await loadLegacyCryptoKeyPair();
  if (!kp) kp = await migrateFromLocalStorage();
  return kp;
}

/**
 * All local key material that might unlock an inbox wrap.
 * Tries the current device record first, then any remaining legacy CryptoKey.
 */
export async function listLocalKeyPairs(): Promise<StoredKeyPair[]> {
  const out: StoredKeyPair[] = [];
  const seen = new Set<string>();

  const current = await getStoredKeyPair();
  if (current) {
    out.push(current);
    seen.add(current.publicKeyB64);
  }

  const legacy = await readLegacyCryptoRecord();
  if (legacy && !seen.has(legacy.publicKeyB64)) {
    if (!current) {
      const migratedOrLegacy = await loadLegacyCryptoKeyPair();
      if (migratedOrLegacy) {
        out.push(migratedOrLegacy);
        return out;
      }
    } else {
      out.push(legacyRecordToStoredKeyPair(legacy));
    }
  }

  if (out.length === 0) {
    const fromLs = await migrateFromLocalStorage();
    if (fromLs) out.push(fromLs);
  }

  return out;
}

/**
 * Ensures we have a device key — IDB record, legacy migrations, or generate new.
 */
export async function ensureKeyPair(): Promise<StoredKeyPair> {
  const existing = await loadExistingKeyPair();
  if (existing) return existing;
  return generateAndStoreKeyPair();
}

/**
 * Ensures a local keypair exists and publishes the public key to the server.
 * Only POSTs when this device's pubkey is not yet registered / changed.
 */
export async function ensureAndPublishKey(
  apiBase: string,
  token: string,
): Promise<StoredKeyPair | null> {
  try {
    const kp = await ensureKeyPair();
    const listRes = await fetch(`${apiBase}/v1/dms/keys`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    let alreadyPublished = false;
    if (listRes.ok) {
      const body = (await listRes.json()) as {
        devices?: Array<{ deviceId: string; publicKey: string }>;
      };
      const mine = body.devices?.find((d) => d.deviceId === kp.deviceId);
      alreadyPublished =
        !!mine && mine.publicKey === kp.publicKeyB64
          ? true
          : !!body.devices?.some((d) => d.publicKey === kp.publicKeyB64);
    }
    if (!alreadyPublished) {
      const res = await fetch(`${apiBase}/v1/dms/keys`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: kp.publicKeyB64, deviceId: kp.deviceId }),
      });
      if (!res.ok && res.status !== 409) {
        return null;
      }
    }
    return kp;
  } catch {
    return null;
  }
}

// ─── Key Derivation & Encryption (DMs — WebCrypto) ──────────────────────────

export async function deriveSharedKey(
  privateKey: CryptoKey,
  publicKeyB64: string,
): Promise<CryptoKey> {
  const pubBytes = Uint8Array.from(atob(publicKeyB64), (c) => c.charCodeAt(0));
  const publicKey = await crypto.subtle.importKey(
    "raw",
    pubBytes as BufferSource,
    { name: "X25519" } as AlgorithmIdentifier,
    false,
    [],
  );
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "X25519", public: publicKey } as AlgorithmIdentifier,
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

// ─── Inbox ECIES ────────────────────────────────────────────────────────────

export async function wrapKeyForRecipient(
  rawKey: Uint8Array,
  recipientPublicKeyB64: string,
): Promise<WrappedKey> {
  try {
    return wrapKeyNoble(rawKey, recipientPublicKeyB64.trim());
  } catch {
    throw new Error("invalid_recipient_key");
  }
}

export async function wrapKeyForRecipients(
  rawKey: Uint8Array,
  recipientPublicKeysB64: string[],
): Promise<WrappedKey[]> {
  const wraps = wrapKeysNoble(rawKey, recipientPublicKeysB64);
  if (wraps.length === 0) throw new Error("invalid_recipient_key");
  return wraps;
}

async function unwrapKeyWebCrypto(
  wrapped: WrappedKey,
  recipientPrivateKey: CryptoKey,
): Promise<Uint8Array> {
  const sharedKey = await deriveSharedKey(recipientPrivateKey, wrapped.wrapEpk);
  const ciphertext = Uint8Array.from(atob(wrapped.wrappedKey), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(wrapped.wrapNonce), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, sharedKey, ciphertext);
  return new Uint8Array(decrypted);
}

export async function unwrapKeyFromSender(
  wrapped: WrappedKey,
  recipientPrivateKey: CryptoKey | Uint8Array,
): Promise<Uint8Array> {
  if (recipientPrivateKey instanceof Uint8Array) {
    return unwrapKeyNoble(wrapped, recipientPrivateKey);
  }
  return unwrapKeyWebCrypto(wrapped, recipientPrivateKey);
}

function isStoredKeyPair(value: unknown): value is StoredKeyPair {
  return (
    !!value &&
    typeof value === "object" &&
    "publicKeyB64" in value &&
    "privateKey" in value &&
    typeof (value as StoredKeyPair).publicKeyB64 === "string"
  );
}

/** Try noble (raw seed) then WebCrypto (CryptoKey) against every wrap. */
export async function unwrapKeyFromAnyWrap(
  wraps: WrappedKey[],
  recipient: StoredKeyPair | Uint8Array | CryptoKey,
): Promise<Uint8Array | null> {
  if (recipient instanceof Uint8Array) {
    return unwrapKeyAnyNoble(wraps, recipient);
  }

  if (isStoredKeyPair(recipient)) {
    if (recipient.privateKeyBytes && recipient.privateKeyBytes.length === 32) {
      const fromNoble = unwrapKeyAnyNoble(wraps, recipient.privateKeyBytes);
      if (fromNoble) return fromNoble;
    }
    for (const wrap of wraps) {
      try {
        return await unwrapKeyWebCrypto(wrap, recipient.privateKey);
      } catch {
        /* try next */
      }
    }
    return null;
  }

  for (const wrap of wraps) {
    try {
      return await unwrapKeyWebCrypto(wrap, recipient);
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * Unlock an inbox secret using every local key we still have
 * (current device seed and/or legacy CryptoKey).
 */
export async function unwrapInboxKey(wraps: WrappedKey[]): Promise<Uint8Array | null> {
  const keys = await listLocalKeyPairs();
  for (const kp of keys) {
    const raw = await unwrapKeyFromAnyWrap(wraps, kp);
    if (raw) return raw;
  }
  return null;
}

export function coalesceWraps(data: {
  wraps?: WrappedKey[] | null;
  wrappedKey?: string | null;
  wrapNonce?: string | null;
  wrapEpk?: string | null;
}): WrappedKey[] {
  if (Array.isArray(data.wraps) && data.wraps.length > 0) {
    return data.wraps.filter((w) => w?.wrappedKey && w?.wrapNonce && w?.wrapEpk);
  }
  if (data.wrappedKey && data.wrapNonce && data.wrapEpk) {
    return [
      {
        wrappedKey: data.wrappedKey,
        wrapNonce: data.wrapNonce,
        wrapEpk: data.wrapEpk,
      },
    ];
  }
  return [];
}
