import { z } from "zod";

export const ProfileSocialLinkInput = z.object({
  platform: z.string().min(1).max(30),
  url: z.string().min(1).max(200),
});

export const CreateUserInput = z.object({
  handle: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_-]+$/)
    .transform((v) => v.trim().toLowerCase()),
  email: z.string().email().optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserInput>;

export const PatchProfileInput = z.object({
  bio: z.string().max(300).optional(),
  avatarUrl: z.string().max(500).nullable().optional(),
  socials: z.array(ProfileSocialLinkInput).max(10).optional(),
  acceptsSecrets: z.boolean().optional(),
});

export type PatchProfileInput = z.infer<typeof PatchProfileInput>;

export const PasskeyLoginOptionsInput = z.object({
  handle: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_-]+$/)
    .transform((v) => v.trim().toLowerCase()),
});

export type PasskeyLoginOptionsInput = z.infer<typeof PasskeyLoginOptionsInput>;

export const SearchUsersQuery = z.object({
  q: z.string().min(2).max(64).transform((v) => v.trim().toLowerCase()),
});

export type SearchUsersQuery = z.infer<typeof SearchUsersQuery>;

export const FollowTargetParams = z.object({
  targetId: z.string().min(1),
});

export type FollowTargetParams = z.infer<typeof FollowTargetParams>;
