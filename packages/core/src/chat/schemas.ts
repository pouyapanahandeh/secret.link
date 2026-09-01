import { z } from "zod";

export const PIN_REGEX = /^\d{4,8}$/;

export const CreateChatInput = z.object({
  ttlSeconds: z.number().int().min(5).max(60 * 60 * 24 * 30),
  maxMembers: z.number().int().min(2).max(50),
  pin: z.string().regex(PIN_REGEX).optional(),
  displayName: z.string().trim().min(1).max(32).optional(),
  anonymous: z.boolean().optional(),
});

export type CreateChatInput = z.infer<typeof CreateChatInput>;

export const JoinChatInput = z.object({
  displayName: z.string().trim().min(1).max(32),
  pin: z.string().regex(PIN_REGEX).optional(),
  anonymous: z.boolean().optional(),
});

export type JoinChatInput = z.infer<typeof JoinChatInput>;

export const PostChatMessageInput = z.object({
  ciphertext: z.string().min(1).max(20_000),
  nonce: z.string().min(1).max(64),
});

export type PostChatMessageInput = z.infer<typeof PostChatMessageInput>;
