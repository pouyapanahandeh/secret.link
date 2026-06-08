import { z } from "zod";

export const CreateSecretSchema = z.object({
  ciphertext: z.string().min(1),
  ttlSeconds: z.number().int().min(60).max(60 * 60 * 24 * 30),
  maxViews: z.number().int().min(1).max(10).default(1),
  workspaceId: z.string().uuid().optional(),
  recipientHandle: z.string().min(1).max(64).optional(),
});

export type CreateSecretPayload = z.infer<typeof CreateSecretSchema>;

export const RevealSecretSchema = z.object({
  id: z.string().uuid(),
});

export type RevealSecretPayload = z.infer<typeof RevealSecretSchema>;

export const SecretResponseSchema = z.object({
  id: z.string().uuid(),
  expiresAt: z.string().datetime(),
});

export type SecretResponse = z.infer<typeof SecretResponseSchema>;
