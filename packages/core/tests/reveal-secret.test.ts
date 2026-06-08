import { describe, it, expect } from "vitest";
import { revealSecret } from "../src/secret/reveal.js";
import type { SecretRecord } from "../src/secret/types.js";

const makeRecord = (overrides?: Partial<SecretRecord>): SecretRecord => ({
  id: "test-id",
  ciphertext: "encrypted-data",
  maxViews: 1,
  viewCount: 0,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  expiresAt: new Date("2026-01-02T00:00:00Z"),
  burned: false,
  ...overrides,
});

const makeDeps = (record: SecretRecord | null = makeRecord()) => ({
  repo: {
    findById: async () => record,
    incrementViewCount: async () => {},
    burn: async () => {},
  },
  clock: { now: () => new Date("2026-01-01T12:00:00Z") },
});

describe("revealSecret", () => {
  it("reveals a valid secret", async () => {
    const result = await revealSecret(makeDeps())("test-id");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.ciphertext).toBe("encrypted-data");
      expect(result.value.remainingViews).toBe(0);
    }
  });

  it("returns not_found for missing secret", async () => {
    const deps = makeDeps(null);
    const result = await revealSecret(deps)("nonexistent");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.kind).toBe("not_found");
    }
  });

  it("returns expired for past-TTL secret", async () => {
    const deps = {
      ...makeDeps(),
      clock: { now: () => new Date("2026-01-03T00:00:00Z") },
    };
    const result = await revealSecret(deps)("test-id");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.kind).toBe("expired");
    }
  });

  it("returns max_views_reached when depleted", async () => {
    const record = makeRecord({ viewCount: 1, maxViews: 1 });
    const deps = makeDeps(record);
    const result = await revealSecret(deps)("test-id");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.kind).toBe("max_views_reached");
    }
  });

  it("returns burned for burned secret", async () => {
    const record = makeRecord({ burned: true });
    const deps = makeDeps(record);
    const result = await revealSecret(deps)("test-id");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.kind).toBe("burned");
    }
  });
});
