import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"

import {
  createQrPublicProjection,
  QR_PUBLIC_PROJECTION_TTL_SECONDS,
  qrPublicProjectionKey,
  type QrPublicProjectionSource,
} from "./src/orpc-server/resource/qr/public-cache.ts"

export const Database = Cloudflare.D1.Database("Database", {
  name: "qr",
  migrations: "./drizzle",
})

export const QrPublicProjection = Cloudflare.KV.Namespace("QrPublicProjection", {
  title: "QR_PUBLIC_PROJECTION",
})

export const BetterAuthSecret = Alchemy.Random("BetterAuthSecret")

export const Website = Cloudflare.Website.Astro(
  "Website",
  Effect.gen(function* () {
    const { stage } = yield* Alchemy.Stack
    const betterAuthSecret = yield* BetterAuthSecret

    return {
      domain: stage === "prod" ? "qr.rindi.tech" : undefined,
      compatibility: {
        date: "2026-07-11",
        flags: ["global_fetch_strictly_public"],
      },
      env: {
        BETTER_AUTH_SECRET: betterAuthSecret.text,
        BETTER_AUTH_URL: Config.string("BETTER_AUTH_URL"),
        RAPIDAPI_KEY: Config.redacted("RAPIDAPI_KEY"),
        DB: Database,
        QR_PUBLIC_PROJECTION: QrPublicProjection,
      },
      observability: { enabled: true },
    }
  }),
)

export type WebsiteEnv = Cloudflare.InferEnv<typeof Website>

const BackfillQrPublicProjection = Alchemy.Action(
  "BackfillQrPublicProjection",
  Effect.gen(function* () {
    const database = yield* Cloudflare.D1.QueryDatabase(Database)
    const namespace = yield* Cloudflare.KV.ReadWriteNamespace(QrPublicProjection)

    return Effect.fn(function* (_input: { schemaVersion: number }) {
      const { results } = yield* database
        .prepare(
          [
            "SELECT id, slug, raw_google_maps_url, google_place_id, canonical_review_url, expires_at, updated_at, deleted_at",
            "FROM qr_codes",
            "ORDER BY slug",
          ].join(" "),
        )
        .all<D1Row>()

      for (const row of results) {
        const projection = createQrPublicProjection(toProjectionSource(row))
        yield* namespace.put(qrPublicProjectionKey(projection.slug), JSON.stringify(projection), {
          expirationTtl: QR_PUBLIC_PROJECTION_TTL_SECONDS,
        })
      }

      yield* Effect.log(`Backfilled ${results.length} QR public projections.`)
    })
  }).pipe(
    Effect.provide(Cloudflare.D1.QueryDatabaseLocal),
    Effect.provide(Cloudflare.KV.ReadWriteNamespaceLocal),
  ),
)

type D1Row = {
  id: string
  slug: string
  raw_google_maps_url: string | null
  google_place_id: string | null
  canonical_review_url: string | null
  expires_at: number | string | null
  updated_at: number | string
  deleted_at: number | string | null
}

function toProjectionSource(row: D1Row): QrPublicProjectionSource {
  const updatedAt = toDate(row.updated_at)
  return {
    id: row.id,
    slug: row.slug,
    rawGoogleMapsUrl: row.raw_google_maps_url,
    googlePlaceId: row.google_place_id,
    canonicalReviewUrl: row.canonical_review_url,
    expiresAt: row.expires_at === null ? null : toDate(row.expires_at),
    updatedAt,
    deletedAt: row.deleted_at === null ? null : toDate(row.deleted_at),
  }
}

function toDate(value: number | string): Date {
  const date = new Date(Number(value))
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid D1 timestamp: ${value}`)
  return date
}

export default Alchemy.Stack(
  "Qr",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const website = yield* Website
    if (process.env.BACKFILL_QR_PUBLIC_PROJECTION === "true") {
      yield* BackfillQrPublicProjection({ schemaVersion: 2 })
    }
    return { url: website.url }
  }),
)
