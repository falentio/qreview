import { readFileSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"

import { describe, expect, it } from "vite-plus/test"

const migrationsDirectory = new URL("../../../drizzle/", import.meta.url)

const migrations = {
  initial: "20260827000000_melodic_morgan_stark/migration.sql",
  auth: "20260827010000_friendly_galactus/migration.sql",
  qrBase: "20260827020000_icy_ego/migration.sql",
  qrResource: "20260827030000_qr_resource/migration.sql",
  legacyContent: "20260827040000_preserve_legacy_qr_content/migration.sql",
  claimability: "20260827050000_mature_selene/migration.sql",
  analytics: "20260827060000_mushy_sally_floyd/migration.sql",
  expiry: "20260827070000_outgoing_pandemic/migration.sql",
} as const

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
  applyMigrations(db, [migrations.initial, migrations.auth, migrations.qrBase])
  return db
}

function insertLegacyQrCodes(db: DatabaseSync) {
  const insert = db.prepare("INSERT INTO qr_codes (id, content, created_at) VALUES (?, ?, ?)")
  insert.run("plain", "  https://example.com/a?b=1  ", 1000)
  insert.run("google", "  https://www.google.com/maps/search/?api=1&query=Example  ", 2000)
  insert.run("empty", "", 3000)
}

function insertLegacyQrCodeBatch(db: DatabaseSync, count: number) {
  const insert = db.prepare("INSERT INTO qr_codes (id, content, created_at) VALUES (?, ?, ?)")
  for (let index = 0; index < count; index += 1) {
    insert.run(`legacy-${index}`, `legacy content ${index}`, 4000 + index)
  }
}

function readLegacyContent(db: DatabaseSync) {
  return db
    .prepare(
      "SELECT qr_code_id AS qrCodeId, content FROM qr_code_legacy_content ORDER BY qr_code_id",
    )
    .all() as Array<{ qrCodeId: string; content: string }>
}

function readClaimability(db: DatabaseSync) {
  return db.prepare("SELECT id, claimable FROM qr_codes ORDER BY id").all() as Array<{
    id: string
    claimable: number
  }>
}

describe("QR migrations", () => {
  it("preserves every legacy content value on a fresh database", () => {
    const db = createPreQrMigrationDatabase()
    insertLegacyQrCodes(db)

    applyMigrations(db, [migrations.qrResource, migrations.legacyContent])

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

  it("backfills unique ten-character lowercase slugs for legacy records", () => {
    const db = createPreQrMigrationDatabase()
    insertLegacyQrCodeBatch(db, 256)

    applyMigrations(db, [migrations.qrResource])

    const slugs = db.prepare("SELECT slug FROM qr_codes").all() as Array<{ slug: string }>
    expect(slugs).toHaveLength(256)
    expect(new Set(slugs.map(({ slug }) => slug)).size).toBe(slugs.length)
    expect(slugs.every(({ slug }) => /^[0-9a-f]{10}$/.test(slug))).toBe(true)
    db.close()
  })

  it("classifies imported and organization-created records when claimability is added", () => {
    const db = createPreQrMigrationDatabase()
    insertLegacyQrCodes(db)

    applyMigrations(db, [migrations.qrResource, migrations.legacyContent])

    db.exec(`
      INSERT INTO organization (id, name, slug, created_at)
      VALUES ('org-1', 'Example', 'example', 4000);
      INSERT INTO qr_codes (
        id, alias, slug, organization_id, created_by_id, created_at, updated_at
      ) VALUES ('owned', 'Owned', 'ownedslug', 'org-1', 'owner', 4000, 4000);
    `)

    applyMigrations(db, [migrations.claimability])

    expect(readClaimability(db)).toEqual([
      { id: "empty", claimable: 1 },
      { id: "google", claimable: 1 },
      { id: "owned", claimable: 0 },
      { id: "plain", claimable: 1 },
    ])

    db.prepare(`
      INSERT INTO qr_codes (
        id, alias, slug, organization_id, created_by_id, claimable, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run("fresh", "Fresh", "freshslug", "org-1", "owner", 0, 5000, 5000)
    expect(readClaimability(db)).toContainEqual({ id: "fresh", claimable: 0 })

    db.prepare(`
      INSERT INTO qr_codes (id, alias, slug, organization_id, created_by_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run("defaulted", "Defaulted", "defaultslug", "org-1", "owner", 6000, 6000)
    expect(readClaimability(db)).toContainEqual({ id: "defaulted", claimable: 1 })
    db.close()
  })

  it("backfills only values still available after an older lossy QR migration", () => {
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
      INSERT INTO organization (id, name, slug, created_at)
      VALUES ('org-1', 'Example', 'example', 4000);
      INSERT INTO qr_codes (
        id, alias, slug, organization_id, created_by_id, created_at, updated_at
      ) VALUES ('owned', 'Owned', 'ownedslug', 'org-1', 'owner', 4000, 4000);
    `)

    applyMigrations(db, [migrations.legacyContent, migrations.claimability])

    expect(readLegacyContent(db)).toEqual([
      {
        qrCodeId: "google",
        content: "https://www.google.com/maps/search/?api=1&query=Example",
      },
    ])
    expect(readClaimability(db)).toEqual([
      { id: "empty", claimable: 1 },
      { id: "google", claimable: 1 },
      { id: "owned", claimable: 0 },
      { id: "plain", claimable: 1 },
    ])
    const beforeRerun = {
      legacyContent: readLegacyContent(db),
      claimability: readClaimability(db),
    }
    expect(() => applyMigrations(db, [migrations.legacyContent])).not.toThrow()
    expect({
      legacyContent: readLegacyContent(db),
      claimability: readClaimability(db),
    }).toEqual(beforeRerun)
    db.close()
  })

  it("creates the hourly QR analytics aggregate table", () => {
    const db = createPreQrMigrationDatabase()

    applyMigrations(db, [
      migrations.qrResource,
      migrations.legacyContent,
      migrations.claimability,
      migrations.analytics,
    ])

    const columns = db.prepare("PRAGMA table_info(qr_analytics_hourly)").all() as Array<{
      name: string
      notnull: number
    }>
    expect(columns.map(({ name }) => name)).toEqual([
      "qr_code_id",
      "bucket_start",
      "redirect_attempts",
    ])
    expect(columns.every(({ notnull }) => notnull === 1)).toBe(true)
    const indexes = db.prepare("PRAGMA index_list(qr_analytics_hourly)").all() as Array<{
      name: string
    }>
    expect(indexes.map(({ name }) => name)).toContain("qr_analytics_hourly_bucket_start_idx")
    const foreignKeys = db.prepare("PRAGMA foreign_key_list(qr_analytics_hourly)").all() as Array<{
      table: string
      from: string
      to: string
      on_delete: string
    }>
    expect(foreignKeys).toContainEqual(
      expect.objectContaining({
        table: "qr_codes",
        from: "qr_code_id",
        to: "id",
        on_delete: "CASCADE",
      }),
    )
    db.close()
  })

  it("adds an optional expiry to QR codes", () => {
    const db = createPreQrMigrationDatabase()

    applyMigrations(db, [
      migrations.qrResource,
      migrations.legacyContent,
      migrations.claimability,
      migrations.analytics,
      migrations.expiry,
    ])

    const column = db
      .prepare("PRAGMA table_info(qr_codes)")
      .all()
      .find((value) => (value as { name: string }).name === "expires_at") as
      | { name: string; type: string; notnull: number }
      | undefined
    expect(column).toMatchObject({ name: "expires_at", type: "INTEGER", notnull: 0 })
    db.close()
  })
})
