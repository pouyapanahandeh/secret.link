import { nanoid } from "nanoid";
import db from "../db.js";

const insert = db.prepare(
  `INSERT INTO audit_log (id, actor_id, actor_handle, action, target_type, target_id, details, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);

export function writeAuditLog(input: {
  actorId: string;
  actorHandle: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: string | null;
}): void {
  insert.run(
    nanoid(),
    input.actorId,
    input.actorHandle,
    input.action,
    input.targetType,
    input.targetId ?? null,
    input.details ?? null,
    new Date().toISOString(),
  );
}
