import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 12 }).notNull(),
    name: varchar("name", { length: 80 }).notNull().default("Untitled room"),
    relayUrl: text("relay_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("rooms_code_unique").on(t.code)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** client-generated id — dedupes WS echo vs. HTTP persistence */
    mid: varchar("mid", { length: 64 }).notNull(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    author: varchar("author", { length: 40 }).notNull(),
    color: varchar("color", { length: 16 }).notNull().default("#c8f04a"),
    body: varchar("body", { length: 2000 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("messages_mid_unique").on(t.mid),
    index("messages_room_created_idx").on(t.roomId, t.createdAt),
  ],
);

export type Room = typeof rooms.$inferSelect;
export type Message = typeof messages.$inferSelect;
