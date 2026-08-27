import * as authSchema from "@/db/auth-schema"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const qrCodes = sqliteTable("qr_codes", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const schema = {
  ...authSchema,
  qrCodes,
}
