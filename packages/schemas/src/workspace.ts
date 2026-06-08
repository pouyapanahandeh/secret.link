import { z } from "zod";

export const WorkspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(128),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  plan: z.enum(["free", "team", "business", "enterprise"]),
  region: z.enum(["us", "eu"]),
  createdAt: z.string().datetime(),
  seatCount: z.number().int().min(1),
  maxSeats: z.number().int().min(1),
});

export type Workspace = z.infer<typeof WorkspaceSchema>;

export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(128),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  region: z.enum(["us", "eu"]),
});

export type CreateWorkspacePayload = z.infer<typeof CreateWorkspaceSchema>;
