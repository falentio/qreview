import * as authSchema from "@/db/auth-schema"
import { integer, index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const qrCodes = sqliteTable(
  "qr_codes",
  {
    id: text("id").primaryKey(),
    alias: text("alias").notNull(),
    slug: text("slug").notNull(),
    rawGoogleMapsUrl: text("raw_google_maps_url"),
    googlePlaceId: text("google_place_id"),
    canonicalReviewUrl: text("canonical_review_url"),
    organizationId: text("organization_id").references(() => authSchema.organization.id, {
      onDelete: "set null",
    }),
    createdById: text("created_by_id").notNull(),
    claimedById: text("claimed_by_id"),
    claimedAt: integer("claimed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("qr_codes_slug_unique").on(table.slug),
    index("qr_codes_organizationId_idx").on(table.organizationId),
  ],
)

export const qrCodeLegacyContent = sqliteTable("qr_code_legacy_content", {
  qrCodeId: text("qr_code_id").primaryKey(),
  content: text("content").notNull(),
})

export const schema = {
  ...authSchema,
  qrCodes,
  qrCodeLegacyContent,
}
