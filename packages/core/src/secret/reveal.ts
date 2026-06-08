import { ok, err } from "neverthrow";
import type { Result } from "neverthrow";
import type { SecretRecord, RevealSecretError } from "./types.js";

export type RevealSecretDeps = {
  readonly repo: {
    findById: (id: string) => Promise<SecretRecord | null>;
    incrementViewCount: (id: string) => Promise<void>;
    burn: (id: string) => Promise<void>;
  };
  readonly clock: { now: () => Date };
};

export const revealSecret =
  (deps: RevealSecretDeps) =>
  async (id: string): Promise<Result<{ ciphertext: string; remainingViews: number }, RevealSecretError>> => {
    const record = await deps.repo.findById(id);

    if (!record) {
      return err({ kind: "not_found" as const });
    }

    if (record.burned) {
      return err({ kind: "burned" as const });
    }

    if (deps.clock.now() > record.expiresAt) {
      return err({ kind: "expired" as const });
    }

    if (record.viewCount >= record.maxViews) {
      return err({ kind: "max_views_reached" as const });
    }

    await deps.repo.incrementViewCount(id);

    const newViewCount = record.viewCount + 1;
    const remainingViews = record.maxViews - newViewCount;

    if (remainingViews <= 0) {
      await deps.repo.burn(id);
    }

    return ok({ ciphertext: record.ciphertext, remainingViews });
  };
