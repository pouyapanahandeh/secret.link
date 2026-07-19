import { z } from "zod";
import { ok, err } from "neverthrow";
import type { Result } from "neverthrow";
import type { SecretRecord, CreateSecretError } from "./types.js";

export const CreateSecretInput = z.object({
  ciphertext: z.string().min(1),
  contentType: z.enum(["text", "image", "video", "file"]).default("text"),
  blobPath: z.string().optional(),
  blobSizeBytes: z.number().int().positive().optional(),
  mimeType: z.string().optional(),
  nonce: z.string().nullish().transform(v => v ?? undefined),
  viewDurationSeconds: z.number().int().min(5).max(300).optional(),
  ttlSeconds: z.number().int().min(5).max(60 * 60 * 24 * 30),
  maxViews: z.number().int().min(1).max(100).default(1),
  workspaceId: z.string().uuid().optional(),
  senderId: z.string().min(1).optional(),
  recipientHandle: z.string().min(1).optional(),
  wrappedKey: z.string().min(1).optional(),
  wrapNonce: z.string().min(1).optional(),
  wrapEpk: z.string().min(1).optional(),
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
    const isProfileSecret = !!parsed.data.recipientHandle;
    // Profile-addressed secrets sit in the recipient's inbox — the link TTL must
    // start when they open the secret, not when it was sent.
    const expiresAt = isProfileSecret
      ? new Date("2099-12-31T23:59:59.000Z")
      : new Date(now.getTime() + parsed.data.ttlSeconds * 1000);

    const record: SecretRecord = {
      id,
      ciphertext: parsed.data.ciphertext,
      contentType: parsed.data.contentType,
      blobPath: parsed.data.blobPath,
      blobSizeBytes: parsed.data.blobSizeBytes,
      mimeType: parsed.data.mimeType,
      nonce: parsed.data.nonce,
      viewDurationSeconds: parsed.data.viewDurationSeconds,
      maxViews: parsed.data.maxViews,
      viewCount: 0,
      createdAt: now,
      expiresAt,
      ttlSeconds: isProfileSecret ? parsed.data.ttlSeconds : undefined,
      workspaceId: parsed.data.workspaceId,
      senderId: parsed.data.senderId,
      recipientHandle: parsed.data.recipientHandle,
      wrappedKey: parsed.data.wrappedKey,
      wrapNonce: parsed.data.wrapNonce,
      wrapEpk: parsed.data.wrapEpk,
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
