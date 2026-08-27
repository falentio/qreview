import { readFileSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"

import { describe, expect, it } from "vite-plus/test"

const migrationsDirectory = new URL("../../../drizzle/", import.meta.url)

function applyMigrations(db: DatabaseSync, names: string[]) {
  for (const name of names) {
    const sql = readFileSync(new URL(name, migrationsDirectory), "utf8")

    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) {
        db.exec(statement)
      }
    }
  }
}

function createPreQrMigrationDatabase() {
  const db = new DatabaseSync(":memory:")
  applyMigrations(db, [
    "0000_melodic_morgan_stark.sql",
    "0001_friendly_galactus.sql",
    "0002_icy_ego.sql",
  ])
  return db
}

function insertLegacyQrCodes(db: DatabaseSync) {
  const insert = db.prepare("INSERT INTO qr_codes (id, content, created_at) VALUES (?, ?, ?)")
  insert.run("plain", "  https://example.com/a?b=1  ", 1000)
  insert.run("google", "  https://www.google.com/maps/search/?api=1&query=Example  ", 2000)
  insert.run("empty", "", 3000)
}

function readLegacyContent(db: DatabaseSync) {
  return db
    .prepare(
      "SELECT qr_code_id AS qrCodeId, content FROM qr_code_legacy_content ORDER BY qr_code_id",
    )
    .all() as Array<{ qrCodeId: string; content: string }>
}

describe("QR migrations", () => {
  it("preserves every legacy content value on a fresh database", () => {
    const db = createPreQrMigrationDatabase()
    insertLegacyQrCodes(db)

    applyMigrations(db, ["0003_qr_resource.sql", "0004_preserve_legacy_qr_content.sql"])

    expect(readLegacyContent(db)).toEqual([
      { qrCodeId: "empty", content: "" },
      {
        qrCodeId: "google",
        content: "  https://www.google.com/maps/search/?api=1&query=Example  ",
      },
      { qrCodeId: "plain", content: "  https://example.com/a?b=1  " },
    ])
    db.close()
  })

  it("backfills only values still available after an older QR migration", () => {
    const db = createPreQrMigrationDatabase()
    insertLegacyQrCodes(db)
    db.exec(`
      CREATE TABLE qr_codes_new (
        id text PRIMARY KEY NOT NULL,
        alias text NOT NULL,
        slug text NOT NULL,
        raw_google_maps_url text,
        google_place_id text,
        canonical_review_url text,
        organization_id text,
        created_by_id text NOT NULL,
        claimed_by_id text,
        claimed_at integer,
        created_at integer NOT NULL,
        updated_at integer NOT NULL,
        deleted_at integer
      );
    `)
    db.exec(`
      INSERT INTO qr_codes_new (
        id, alias, slug, raw_google_maps_url, created_by_id, created_at, updated_at
      )
      SELECT
        id,
        substr(trim(content), 1, 120),
        lower(substr(hex(randomblob(5)), 1, 10)),
        CASE WHEN id = 'google' THEN trim(content) ELSE NULL END,
        'migration',
        created_at,
        created_at
      FROM qr_codes;
      DROP TABLE qr_codes;
      ALTER TABLE qr_codes_new RENAME TO qr_codes;
    `)

    applyMigrations(db, ["0004_preserve_legacy_qr_content.sql"])

    expect(readLegacyContent(db)).toEqual([
      {
        qrCodeId: "google",
        content: "https://www.google.com/maps/search/?api=1&query=Example",
      },
    ])
    expect(() => applyMigrations(db, ["0004_preserve_legacy_qr_content.sql"])).not.toThrow()
    db.close()
  })
})
