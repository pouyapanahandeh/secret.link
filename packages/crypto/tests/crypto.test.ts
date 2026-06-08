import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "../src/aes-gcm.js";
import { deriveKey } from "../src/key-derivation.js";
import { generateDEK, wrapDEK, unwrapDEK } from "../src/envelope.js";

describe("encrypt / decrypt", () => {
  it("round-trips a message", async () => {
    const { key } = await deriveKey("my-password");
    const payload = await encrypt("Hello, secret world!", key);
    const plaintext = await decrypt(payload, key);
    expect(plaintext).toBe("Hello, secret world!");
  });

  it("fails with wrong key", async () => {
    const { key: key1 } = await deriveKey("password1");
    const { key: key2 } = await deriveKey("password2");
    const payload = await encrypt("secret", key1);
    await expect(decrypt(payload, key2)).rejects.toThrow();
  });
});

describe("envelope encryption", () => {
  it("wraps and unwraps a DEK", async () => {
    const dek = await generateDEK();
    const { key: kek } = await deriveKey("master-key");
    const { wrapped, nonce } = await wrapDEK(dek, kek);
    const unwrappedDek = await unwrapDEK(wrapped, nonce, kek);
    expect(unwrappedDek).toEqual(dek);
  });
});
