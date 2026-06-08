import { pgTable, uuid, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces.js";

export const channelModeEnum = pgEnum("channel_mode", ["one_way", "two_way"]);

export const feedbackChannels = pgTable("feedback_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id).notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  mode: channelModeEnum("mode").default("one_way").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const feedbackMessages = pgTable("feedback_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: uuid("channel_id").references(() => feedbackChannels.id).notNull(),
  ciphertext: text("ciphertext").notNull(),
  senderFingerprint: text("sender_fingerprint"),
  sentimentTag: text("sentiment_tag"),
  topicTag: text("topic_tag"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});
