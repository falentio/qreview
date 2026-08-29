import { execFile } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"

import {
  createQrPublicProjection,
  QR_PUBLIC_PROJECTION_TTL_SECONDS,
  qrPublicProjectionKey,
  type QrPublicProjectionSource,
} from "../src/orpc-server/resource/qr/public-cache"

const execFileAsync = promisify(execFile)
const databaseName = getOption("--database") ?? "qr"
const target = process.argv.includes("--local") ? "--local" : "--remote"

if (!process.argv.includes("--local") && !process.argv.includes("--remote")) {
  throw new Error("Choose a target with --local or --remote.")
}

const query = [
  "SELECT id, slug, raw_google_maps_url, google_place_id, canonical_review_url, updated_at, deleted_at",
  "FROM qr_codes",
  "ORDER BY slug",
].join(" ")

const { stdout } = await runWrangler([
  "d1",
  "execute",
  databaseName,
  "--command",
  query,
  target,
  "--json",
])
const rows = readRows(stdout)
const entries = rows.map((row) => {
  const projection = createQrPublicProjection(toProjectionSource(row))
  return {
    key: qrPublicProjectionKey(projection.slug),
    value: JSON.stringify(projection),
    expiration_ttl: QR_PUBLIC_PROJECTION_TTL_SECONDS,
  }
})

const temporaryDirectory = await mkdtemp(join(tmpdir(), "qr-public-projection-"))
try {
  for (const [index, batch] of chunk(entries, 10_000).entries()) {
    const filePath = join(temporaryDirectory, `batch-${index}.json`)
    await writeFile(filePath, JSON.stringify(batch))
    await runWrangler(["kv", "bulk", "put", filePath, "--binding", "QR_PUBLIC_PROJECTION", target])
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}

process.stdout.write(`Backfilled ${entries.length} QR public projections.\n`)

async function runWrangler(args: string[]): Promise<{ stdout: string }> {
  return execFileAsync("vp", ["exec", "wrangler", ...args], {
    maxBuffer: 100 * 1024 * 1024,
  })
}

function readRows(stdout: string): D1Row[] {
  const response = JSON.parse(stdout) as Array<{ results?: D1Row[] }>
  return response.flatMap((result) => result.results ?? [])
}

function toProjectionSource(row: D1Row): QrPublicProjectionSource {
  const updatedAt = toDate(row.updated_at)
  return {
    id: row.id,
    slug: row.slug,
    rawGoogleMapsUrl: row.raw_google_maps_url,
    googlePlaceId: row.google_place_id,
    canonicalReviewUrl: row.canonical_review_url,
    updatedAt,
    deletedAt: row.deleted_at === null ? null : toDate(row.deleted_at),
  }
}

function toDate(value: number | string): Date {
  const date = new Date(Number(value))
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid D1 timestamp: ${value}`)
  return date
}

function chunk<T>(values: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size))
  }
  return batches
}

function getOption(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

type D1Row = {
  id: string
  slug: string
  raw_google_maps_url: string | null
  google_place_id: string | null
  canonical_review_url: string | null
  updated_at: number | string
  deleted_at: number | string | null
}
