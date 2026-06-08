import { pgTable, uuid, varchar, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const planEnum = pgEnum("plan", ["free", "team", "business", "enterprise"]);
export const regionEnum = pgEnum("region", ["us", "eu"]);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 64 }).unique().notNull(),
  plan: planEnum("plan").default("free").notNull(),
  region: regionEnum("region").notNull(),
  seatCount: integer("seat_count").default(1).notNull(),
  maxSeats: integer("max_seats").default(15).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const memberRoleEnum = pgEnum("member_role", ["owner", "admin", "member"]);

export const workspaceMembers = pgTable("workspace_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  role: memberRoleEnum("role").default("member").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
});
