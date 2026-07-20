import { describe, it, expect } from "vitest";
import { encryptString, decryptString } from "../src/aes-gcm.js";
import { deriveKey } from "../src/key-derivation.js";
import { generateDEK, wrapDEK, unwrapDEK } from "../src/envelope.js";

describe("encrypt / decrypt", () => {
  it("round-trips a message", () => {
    const { key } = deriveKey("my-password");
    const payload = encryptString("Hello, secret world!", key);
    const plaintext = decryptString(payload, key);
    expect(plaintext).toBe("Hello, secret world!");
  });

  it("fails with wrong key", () => {
    const { key: key1 } = deriveKey("password1");
    const { key: key2 } = deriveKey("password2");
    const payload = encryptString("secret", key1);
    expect(() => decryptString(payload, key2)).toThrow();
  });
});

describe("envelope encryption", () => {
  it("wraps and unwraps a DEK", () => {
    const dek = generateDEK();
    const { key: kek } = deriveKey("master-key");
    const { wrapped, nonce } = wrapDEK(dek, kek);
    const unwrappedDek = unwrapDEK(wrapped, nonce, kek);
    expect(unwrappedDek).toEqual(dek);
  });
});
