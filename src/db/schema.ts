import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  data: text("data"),
  created_at: integer("created_at").notNull(),
});