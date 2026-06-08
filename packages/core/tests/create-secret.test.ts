import { describe, it, expect } from "vitest";
import { createSecret } from "../src/secret/create.js";

const makeDeps = () => ({
  repo: { save: async () => {} },
  kms: { wrap: async () => "wrapped-key" },
  clock: { now: () => new Date("2026-01-01T00:00:00Z") },
  id: () => "test-id-123",
});

describe("createSecret", () => {
  it("creates a secret with valid input", async () => {
    const deps = makeDeps();
    const result = await createSecret(deps)({
      ciphertext: "encrypted-data",
      ttlSeconds: 3600,
      maxViews: 1,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.id).toBe("test-id-123");
      expect(result.value.expiresAt).toEqual(new Date("2026-01-01T01:00:00Z"));
    }
  });

  it("rejects empty ciphertext", async () => {
    const deps = makeDeps();
    const result = await createSecret(deps)({
      ciphertext: "",
      ttlSeconds: 3600,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.kind).toBe("invalid_input");
    }
  });

  it("rejects TTL below minimum", async () => {
    const deps = makeDeps();
    const result = await createSecret(deps)({
      ciphertext: "data",
      ttlSeconds: 10,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.kind).toBe("invalid_input");
    }
  });

  it("rejects TTL above maximum (30 days)", async () => {
    const deps = makeDeps();
    const result = await createSecret(deps)({
      ciphertext: "data",
      ttlSeconds: 60 * 60 * 24 * 31,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.kind).toBe("invalid_input");
    }
  });

  it("returns storage_error when repo.save throws", async () => {
    const deps = {
      ...makeDeps(),
      repo: { save: async () => { throw new Error("DB down"); } },
    };
    const result = await createSecret(deps)({
      ciphertext: "data",
      ttlSeconds: 3600,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.kind).toBe("storage_error");
    }
  });
});
