/** AES-256-GCM protocol constants shared by web and mobile clients. */
export const AES_KEY_BYTES = 32;
export const AES_GCM_IV_BYTES = 12;

/** Map secrets and standalone DEKs use base64url without padding. */
export const MAP_KEY_ENCODING = "base64url" as const;

/** X25519 wrap fields (wrappedKey, wrapNonce, wrapEpk) use standard base64. */
export const WRAP_FIELD_ENCODING = "base64" as const;
