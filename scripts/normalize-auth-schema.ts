import { readFile, writeFile } from "node:fs/promises"

const authSchemaPath = new URL("../src/db/auth-schema.ts", import.meta.url)
const source = await readFile(authSchemaPath, "utf8")
let normalized = source.replace("import { relations, sql }", "import { sql }")

normalized = normalized
  .replace('email: text("email").notNull().unique(),', 'email: text("email").notNull(),')
  .replace(
    '  banExpires: integer("ban_expires", { mode: "timestamp_ms" }),\n});\n\nexport const session',
    '  banExpires: integer("ban_expires", { mode: "timestamp_ms" }),\n}, (table) => [uniqueIndex("user_email_unique").on(table.email)]);\n\nexport const session',
  )
  .replace('token: text("token").notNull().unique(),', 'token: text("token").notNull(),')
  .replace(
    '  (table) => [index("session_userId_idx").on(table.userId)],',
    '  (table) => [\n    uniqueIndex("session_token_unique").on(table.token),\n    index("session_userId_idx").on(table.userId),\n  ],',
  )
  .replace('slug: text("slug").notNull().unique(),', 'slug: text("slug").notNull(),')
  .replace(
    '  metadata: text("metadata"),\n});\n\nexport const member',
    '  metadata: text("metadata"),\n}, (table) => [uniqueIndex("organization_slug_unique").on(table.slug)]);\n\nexport const member',
  )

const relationStart = normalized.indexOf("\nexport const userRelations")

if (relationStart !== -1) {
  normalized = normalized.slice(0, relationStart)
}

normalized = `${normalized.trimEnd()}\n`
if (normalized !== source) {
  await writeFile(authSchemaPath, normalized)
}
