import { describe, it, expect } from "vitest";
import {
  encryptAesGcm,
  decryptAesGcm,
  encryptMapMessage,
  decryptMapReveal,
  wrapKeyForRecipient,
  unwrapKeyFromSender,
  x25519,
  base64UrlToBytes,
  bytesToBase64Url,
} from "../src/index.js";

/** Fixed test keys — never use in production. */
const FIXED_AES_KEY = base64UrlToBytes("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
const FIXED_IV = base64UrlToBytes("AAAAAAAAAAAAAA");
const FIXED_PLAINTEXT = new TextEncoder().encode("hello secretlink");

const RECIPIENT_PRIVATE = new Uint8Array(32).fill(7);
const RECIPIENT_PUBLIC = x25519.getPublicKey(RECIPIENT_PRIVATE);

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

describe("cross-platform AES-GCM vectors", () => {
  it("encrypts and decrypts with fixed key/iv", () => {
    const { ciphertext } = encryptAesGcm(FIXED_PLAINTEXT, FIXED_AES_KEY, FIXED_IV);
    const decrypted = decryptAesGcm(ciphertext, FIXED_AES_KEY, FIXED_IV);
    expect(new TextDecoder().decode(decrypted)).toBe("hello secretlink");
  });

  it("round-trips map message encrypt/decrypt", () => {
    const encrypted = encryptMapMessage("map drop test");
    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.nonce).toBeTruthy();
    expect(encrypted.key).toBeTruthy();
    expect(decryptMapReveal(encrypted)).toBe("map drop test");
  });

  it("decrypts legacy plaintext map reveals", () => {
    expect(decryptMapReveal({ message: "legacy text", legacy: true })).toBe("legacy text");
  });

  it("wraps and unwraps AES key for recipient", () => {
    const recipientPublicKeyB64 = bytesToBase64(RECIPIENT_PUBLIC);
    const wrapped = wrapKeyForRecipient(FIXED_AES_KEY, recipientPublicKeyB64);
    const unwrapped = unwrapKeyFromSender(wrapped, RECIPIENT_PRIVATE);
    expect(unwrapped).toEqual(FIXED_AES_KEY);
  });
});

describe("encoding rules", () => {
  it("uses base64url for map key material", () => {
    const { key, nonce, ciphertext } = encryptMapMessage("x");
    expect(key).not.toMatch(/[+/=]/);
    expect(nonce).not.toMatch(/[+/=]/);
    expect(ciphertext).not.toMatch(/[+/=]/);
  });

  it("uses standard base64 for wrap fields", () => {
    const recipientPublicKeyB64 = bytesToBase64(RECIPIENT_PUBLIC);
    const wrapped = wrapKeyForRecipient(FIXED_AES_KEY, recipientPublicKeyB64);
    expect(wrapped.wrapEpk).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(wrapped.wrappedKey).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(wrapped.wrapNonce).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});
