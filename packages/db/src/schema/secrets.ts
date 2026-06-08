import { pgTable, uuid, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces.js";

export const secrets = pgTable("secrets", {
  id: uuid("id").primaryKey().defaultRandom(),
  ciphertext: text("ciphertext").notNull(),
  wrappedDek: text("wrapped_dek"),
  dekNonce: text("dek_nonce"),
  maxViews: integer("max_views").default(1).notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  burned: boolean("burned").default(false).notNull(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  senderId: uuid("sender_id"),
  recipientHandle: text("recipient_handle"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
