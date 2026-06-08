import { z } from "zod";
import { ok, err } from "neverthrow";
import type { Result } from "neverthrow";
import type { SecretRecord, CreateSecretError } from "./types.js";

export const CreateSecretInput = z.object({
  ciphertext: z.string().min(1),
  ttlSeconds: z.number().int().min(60).max(60 * 60 * 24 * 30),
  maxViews: z.number().int().min(1).max(10).default(1),
  workspaceId: z.string().uuid().optional(),
  recipientHandle: z.string().min(1).optional(),
});

export type CreateSecretInput = z.infer<typeof CreateSecretInput>;

export type CreateSecretDeps = {
  readonly repo: { save: (s: SecretRecord) => Promise<void> };
  readonly kms: { wrap: (dek: Uint8Array, wsId?: string) => Promise<string> };
  readonly clock: { now: () => Date };
  readonly id: () => string;
};

export const createSecret =
  (deps: CreateSecretDeps) =>
  async (raw: unknown): Promise<Result<{ id: string; expiresAt: Date }, CreateSecretError>> => {
    const parsed = CreateSecretInput.safeParse(raw);
    if (!parsed.success) {
      return err({ kind: "invalid_input" as const, issues: parsed.error.issues });
    }

    const id = deps.id();
    const now = deps.clock.now();
    const expiresAt = new Date(now.getTime() + parsed.data.ttlSeconds * 1000);

    const record: SecretRecord = {
      id,
      ciphertext: parsed.data.ciphertext,
      maxViews: parsed.data.maxViews,
      viewCount: 0,
      createdAt: now,
      expiresAt,
      workspaceId: parsed.data.workspaceId,
      recipientHandle: parsed.data.recipientHandle,
      burned: false,
    };

    try {
      await deps.repo.save(record);
    } catch (e) {
      return err({
        kind: "storage_error" as const,
        message: e instanceof Error ? e.message : "Unknown error",
      });
    }

    return ok({ id, expiresAt });
  };
