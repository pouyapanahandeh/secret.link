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

  it("defers link expiry for profile-addressed secrets until first reveal", async () => {
    let saved: any;
    const deps = {
      ...makeDeps(),
      repo: { save: async (record: any) => { saved = record; } },
    };
    const result = await createSecret(deps)({
      ciphertext: "encrypted-data",
      ttlSeconds: 3600,
      recipientHandle: "alice",
      maxViews: 1,
    });

    expect(result.isOk()).toBe(true);
    expect(saved.ttlSeconds).toBe(3600);
    expect(saved.expiresAt).toEqual(new Date("2099-12-31T23:59:59.000Z"));
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
      ttlSeconds: 2, // schema minimum is 5 seconds
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

  it("accepts wraps[] and persists wrapsJson plus legacy first wrap", async () => {
    let saved: any;
    const deps = {
      ...makeDeps(),
      repo: { save: async (record: any) => { saved = record; } },
    };
    const result = await createSecret(deps)({
      ciphertext: "encrypted-data",
      ttlSeconds: 3600,
      recipientHandle: "alice",
      wraps: [
        { wrappedKey: "w1", wrapNonce: "n1", wrapEpk: "e1" },
        { wrappedKey: "w2", wrapNonce: "n2", wrapEpk: "e2" },
      ],
    });

    expect(result.isOk()).toBe(true);
    expect(saved.wrappedKey).toBe("w1");
    expect(saved.wrapNonce).toBe("n1");
    expect(saved.wrapEpk).toBe("e1");
    expect(JSON.parse(saved.wrapsJson)).toHaveLength(2);
  });

  it("rejects more than 5 wraps", async () => {
    const deps = makeDeps();
    const wraps = Array.from({ length: 6 }, (_, i) => ({
      wrappedKey: `w${i}`,
      wrapNonce: `n${i}`,
      wrapEpk: `e${i}`,
    }));
    const result = await createSecret(deps)({
      ciphertext: "data",
      ttlSeconds: 3600,
      wraps,
    });
    expect(result.isErr()).toBe(true);
  });
});
