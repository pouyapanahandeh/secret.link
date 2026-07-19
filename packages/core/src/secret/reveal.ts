import { ok, err } from "neverthrow";
import type { Result } from "neverthrow";
import type { SecretRecord, RevealSecretError, ContentType } from "./types.js";

export type RevealSecretDeps = {
  readonly repo: {
    findById: (id: string) => Promise<SecretRecord | null>;
    incrementViewCount: (id: string) => Promise<void>;
    burn: (id: string) => Promise<void>;
    setExpiresAt: (id: string, expiresAt: Date) => Promise<void>;
  };
  readonly clock: { now: () => Date };
};

export type RevealResult = {
  ciphertext: string;
  contentType: ContentType;
  blobPath?: string;
  mimeType?: string;
  nonce?: string;
  viewDurationSeconds?: number;
  remainingViews: number;
  maxViews: number;
};

export const revealSecret =
  (deps: RevealSecretDeps) =>
  async (id: string): Promise<Result<RevealResult, RevealSecretError>> => {
    const record = await deps.repo.findById(id);

    if (!record) {
      return err({ kind: "not_found" as const });
    }

    if (record.burned) {
      return err({ kind: "burned" as const });
    }

    const revealActivatedTtl = record.ttlSeconds != null;
    if (
      (!revealActivatedTtl || record.viewCount > 0) &&
      deps.clock.now() > record.expiresAt
    ) {
      return err({ kind: "expired" as const });
    }

    if (record.viewCount >= record.maxViews) {
      return err({ kind: "max_views_reached" as const });
    }

    if (revealActivatedTtl && record.viewCount === 0) {
      const activatedExpiry = new Date(
        deps.clock.now().getTime() + record.ttlSeconds! * 1000,
      );
      await deps.repo.setExpiresAt(id, activatedExpiry);
    }

    await deps.repo.incrementViewCount(id);

    const newViewCount = record.viewCount + 1;
    const remainingViews = record.maxViews - newViewCount;

    if (remainingViews <= 0) {
      await deps.repo.burn(id);
    }

    return ok({
      ciphertext: record.ciphertext,
      contentType: record.contentType,
      blobPath: record.blobPath,
      mimeType: record.mimeType,
      nonce: record.nonce,
      viewDurationSeconds: record.viewDurationSeconds,
      remainingViews,
      maxViews: record.maxViews,
    });
  };
