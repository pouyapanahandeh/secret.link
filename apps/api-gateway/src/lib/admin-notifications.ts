import { z } from "zod";
import db from "../db.js";

export const MAX_ADMIN_NOTIFICATION_RECIPIENTS = 20_000;

const handleField = z
  .string()
  .trim()
  .transform((value) => value.replace(/^@+/, "").toLowerCase())
  .pipe(z.string().min(3).max(32).regex(/^[a-z0-9_-]+$/));

export const AudienceSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("handle"),
    handle: handleField,
    includeSuspended: z.boolean().optional(),
  }),
  z.object({
    mode: z.literal("all"),
    includeSuspended: z.boolean().optional(),
  }),
  z.object({
    mode: z.literal("filter"),
    includeSuspended: z.boolean().optional(),
    roles: z.array(z.enum(["user", "moderator", "editor", "admin"])).max(4).optional(),
    signedUpWithinDays: z.number().int().min(1).max(3650).optional(),
    lastSeenWithinDays: z.number().int().min(1).max(3650).optional(),
    hasPushSubscription: z.boolean().optional(),
  }),
]);

export type Audience = z.infer<typeof AudienceSchema>;

export const PreviewNotificationInput = z.object({
  audience: AudienceSchema,
});

export const SendNotificationInput = z.object({
  audience: AudienceSchema,
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(280),
  confirmCount: z.number().int().min(0),
});

export type Recipient = { id: string; handle: string };

const ACTIVE_SUSPENSION_SQL = `
  SELECT 1 FROM user_suspensions s
  WHERE s.user_id = u.id
    AND s.lifted_at IS NULL
    AND (s.expires_at IS NULL OR s.expires_at > ?)
`;

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function buildAudienceSql(audience: Audience): { sql: string; params: unknown[] } {
  const now = new Date().toISOString();
  const where: string[] = ["1 = 1"];
  const params: unknown[] = [];

  if (!audience.includeSuspended) {
    where.push(`NOT EXISTS (${ACTIVE_SUSPENSION_SQL})`);
    params.push(now);
  }

  if (audience.mode === "handle") {
    where.push("u.handle = ?");
    params.push(audience.handle);
  }

  if (audience.mode === "filter") {
    if (audience.roles && audience.roles.length > 0) {
      where.push(`COALESCE(u.role, 'user') IN (${audience.roles.map(() => "?").join(",")})`);
      params.push(...audience.roles);
    }
    if (audience.signedUpWithinDays) {
      where.push("u.created_at >= ?");
      params.push(daysAgoIso(audience.signedUpWithinDays));
    }
    if (audience.lastSeenWithinDays) {
      where.push("u.last_seen_at IS NOT NULL AND u.last_seen_at >= ?");
      params.push(daysAgoIso(audience.lastSeenWithinDays));
    }
    if (audience.hasPushSubscription) {
      where.push("EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = u.id)");
    }
  }

  return { sql: where.join(" AND "), params };
}

export function summarizeAudience(audience: Audience): string {
  if (audience.mode === "handle") {
    const extra = audience.includeSuspended ? " (incl. suspended)" : "";
    return `@${audience.handle}${extra}`;
  }
  if (audience.mode === "all") {
    return audience.includeSuspended ? "all users (incl. suspended)" : "all users";
  }
  const parts: string[] = [];
  if (audience.roles?.length) parts.push(`roles ${audience.roles.join(", ")}`);
  if (audience.signedUpWithinDays) parts.push(`signed up ≤${audience.signedUpWithinDays}d`);
  if (audience.lastSeenWithinDays) parts.push(`last seen ≤${audience.lastSeenWithinDays}d`);
  if (audience.hasPushSubscription) parts.push("has push");
  if (audience.includeSuspended) parts.push("incl. suspended");
  return parts.length > 0 ? parts.join(" · ") : "filtered users";
}

export function previewAudience(audience: Audience): { count: number; sampleHandles: string[] } {
  const { sql, params } = buildAudienceSql(audience);
  const countRow = db
    .prepare(`SELECT COUNT(*) AS c FROM users u WHERE ${sql}`)
    .get(...params) as { c: number };
  const samples = db
    .prepare(`SELECT u.handle FROM users u WHERE ${sql} ORDER BY u.created_at DESC LIMIT 8`)
    .all(...params) as Array<{ handle: string }>;
  return {
    count: Number(countRow.c),
    sampleHandles: samples.map((row) => row.handle),
  };
}

export function listAudienceIds(audience: Audience, limit: number): Recipient[] {
  const { sql, params } = buildAudienceSql(audience);
  return db
    .prepare(`SELECT u.id, u.handle FROM users u WHERE ${sql} ORDER BY u.created_at DESC LIMIT ?`)
    .all(...params, limit) as Recipient[];
}

export function assertAudienceAllowed(role: string, audience: Audience): boolean {
  if (role === "admin") return true;
  return audience.mode === "handle";
}
