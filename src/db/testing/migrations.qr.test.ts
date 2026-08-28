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

  it("backfills unique ten-character lowercase slugs for legacy records", () => {
    const db = createPreQrMigrationDatabase()
    insertLegacyQrCodeBatch(db, 256)

    applyMigrations(db, ["0003_qr_resource.sql"])

    const slugs = db.prepare("SELECT slug FROM qr_codes").all() as Array<{ slug: string }>
    expect(slugs).toHaveLength(256)
    expect(new Set(slugs.map(({ slug }) => slug)).size).toBe(slugs.length)
    expect(slugs.every(({ slug }) => /^[0-9a-f]{10}$/.test(slug))).toBe(true)
    db.close()
  })

  it("classifies imported and organization-created records when claimability is added", () => {
    const db = createPreQrMigrationDatabase()
    insertLegacyQrCodes(db)

    applyMigrations(db, ["0003_qr_resource.sql", "0004_preserve_legacy_qr_content.sql"])

    db.exec(`
      INSERT INTO organization (id, name, slug, created_at)
      VALUES ('org-1', 'Example', 'example', 4000);
      INSERT INTO qr_codes (
        id, alias, slug, organization_id, created_by_id, created_at, updated_at
      ) VALUES ('owned', 'Owned', 'ownedslug', 'org-1', 'owner', 4000, 4000);
    `)

    applyMigrations(db, ["0005_mature_selene.sql"])

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

    applyMigrations(db, ["0004_preserve_legacy_qr_content.sql", "0005_mature_selene.sql"])

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
    expect(() => applyMigrations(db, ["0004_preserve_legacy_qr_content.sql"])).not.toThrow()
    expect({
      legacyContent: readLegacyContent(db),
      claimability: readClaimability(db),
    }).toEqual(beforeRerun)
    db.close()
  })
})
