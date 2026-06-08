import { z } from "zod";

export const UserSchema = z.object({
  id: z.string().uuid(),
  handle: z.string().min(3).max(32).regex(/^[a-z0-9_-]+$/),
  email: z.string().email().optional(),
  createdAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = z.object({
  handle: z.string().min(3).max(32).regex(/^[a-z0-9_-]+$/),
  email: z.string().email().optional(),
});

export type CreateUserPayload = z.infer<typeof CreateUserSchema>;
