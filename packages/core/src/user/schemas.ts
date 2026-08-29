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

export const PasskeyIdParams = z.object({
  id: z.string().min(1).max(256),
});

export type PasskeyIdParams = z.infer<typeof PasskeyIdParams>;

const RECOVERY_CODE_RE = /[A-Z2-9]{4}-[A-Z2-9]{4}/i;

/** First `XXXX-XXXX` in a pasted list, or an 8-char compact code. */
export function extractRecoveryCode(raw: string): string {
  const match = raw.toUpperCase().match(RECOVERY_CODE_RE);
  if (match) return match[0];
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length === 8) return `${compact.slice(0, 4)}-${compact.slice(4)}`;
  return raw.trim();
}

export const RecoveryCodeLoginInput = z.object({
  handle: z
    .string()
    .transform((v) => v.trim().toLowerCase().replace(/^@+/, ""))
    .pipe(z.string().min(3).max(32).regex(/^[a-z0-9_-]+$/)),
  code: z
    .string()
    .transform((v) => extractRecoveryCode(v))
    .pipe(z.string().regex(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/i)),
});

export type RecoveryCodeLoginInput = z.infer<typeof RecoveryCodeLoginInput>;
