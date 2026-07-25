import { z } from "zod";

export const CreateMapSecretInput = z.object({
  ciphertext: z.string().min(1).max(4096),
  nonce: z.string().min(1).max(64),
  key: z.string().min(1).max(128),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  emoji: z.string().max(4).default("💬"),
  handle: z.string().max(64).optional(),
  locationName: z.string().max(160).optional(),
  cityName: z.string().max(80).optional(),
  countryName: z.string().max(80).optional(),
  ttlMinutes: z.number().int().min(5).max(1440).default(60),
  mediaPath: z.string().max(500).nullish(),
  mediaType: z.string().max(64).nullish(),
  revealMode: z.enum(["timer", "clicks"]).default("timer"),
  revealTimerSeconds: z.number().int().min(5).max(300).default(30),
  maxClicks: z.number().int().min(0).max(1000).default(0),
});

export type CreateMapSecretInput = z.infer<typeof CreateMapSecretInput>;

export const MapReportInput = z.object({
  reason: z.enum(["spam", "harassment", "hate", "sexual", "violence", "illegal", "other"]),
  details: z.string().max(2000).optional(),
});

export type MapReportInput = z.infer<typeof MapReportInput>;

export const MapRevealParams = z.object({
  id: z.string().min(1),
});

export type MapRevealParams = z.infer<typeof MapRevealParams>;
