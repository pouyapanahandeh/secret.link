import { describe, it, expect } from "vitest";
import { CreateMapSecretInput } from "../src/map/schemas.js";

describe("CreateMapSecretInput", () => {
  const base = {
    ciphertext: "abc",
    nonce: "nonce",
    key: "key",
    lat: 47.5,
    lng: 19.03,
  };

  it("accepts omitted media fields for text-only pins", () => {
    const parsed = CreateMapSecretInput.parse(base);
    expect(parsed.mediaPath).toBeUndefined();
    expect(parsed.mediaType).toBeUndefined();
  });

  it("accepts null media fields from legacy clients", () => {
    const parsed = CreateMapSecretInput.parse({
      ...base,
      mediaPath: null,
      mediaType: null,
    });
    expect(parsed.mediaPath).toBeNull();
    expect(parsed.mediaType).toBeNull();
  });
});
