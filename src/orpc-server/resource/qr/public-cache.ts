import type { WaitUntil } from "@/orpc-server/events"
import type { KvStore } from "@/orpc-server/resource/qr/cache"
import type { QrRecord } from "@/orpc-server/resource/qr/repository"
import {
  isGoogleCanonicalReviewUrlForPlace,
  isGoogleMapsShortUrl,
  isGooglePlaceId,
  parseGoogleMapsUrl,
} from "./url.ts"

export type QrPublicProjection =
  | {
      schemaVersion: 2
      slug: string
      qrCodeId: string
      state: "active"
      googlePlaceId: string
      canonicalReviewUrl: string
      expiresAt: string | null
      updatedAt: string
    }
  | {
      schemaVersion: 2
      slug: string
      qrCodeId: string
      state: "setup" | "archived"
      expiresAt: string | null
      updatedAt: string
    }

export const QR_PUBLIC_PROJECTION_TTL_SECONDS = 7 * 24 * 60 * 60

export type QrPublicProjectionStore = {
  get({ slug }: { slug: string }): Promise<QrPublicProjection | null>
  set(projection: QrPublicProjection): void
  setAndWait?(projection: QrPublicProjection): Promise<void>
}

export type QrPublicProjectionSource = Pick<
  QrRecord,
  | "id"
  | "slug"
  | "rawGoogleMapsUrl"
  | "googlePlaceId"
  | "canonicalReviewUrl"
  | "expiresAt"
  | "updatedAt"
  | "deletedAt"
>

type ProjectionLogger = Pick<Console, "warn">

export class CloudflareQrPublicProjectionCache implements QrPublicProjectionStore {
  private readonly dependencies: {
    namespace: KvStore
    waitUntil: WaitUntil
    logger?: ProjectionLogger
  }

  constructor(dependencies: {
    namespace: KvStore
    waitUntil: WaitUntil
    logger?: ProjectionLogger
  }) {
    this.dependencies = dependencies
  }

  async get({ slug }: { slug: string }): Promise<QrPublicProjection | null> {
    try {
      const value = await this.dependencies.namespace.get(qrPublicProjectionKey(slug), "text")
      if (value === null) return null

      const projection = JSON.parse(value) as unknown
      validateProjection(projection, slug)
      return projection
    } catch (error) {
      this.dependencies.logger?.warn("QR public projection read failed.", { slug, error })
      return null
    }
  }

  set(projection: QrPublicProjection): void {
    const write = this.write(projection)
    const observedWrite = write.catch((error) => {
      this.logWriteFailure(projection.slug, error)
    })
    try {
      this.dependencies.waitUntil(observedWrite)
    } catch (error) {
      this.dependencies.logger?.warn("QR public projection scheduling failed.", {
        slug: projection.slug,
        error,
      })
    }
  }

  async setAndWait(projection: QrPublicProjection): Promise<void> {
    try {
      await this.write(projection)
    } catch (error) {
      this.logWriteFailure(projection.slug, error)
      throw error
    }
  }

  private async write(projection: QrPublicProjection): Promise<void> {
    await this.dependencies.namespace.put(
      qrPublicProjectionKey(projection.slug),
      JSON.stringify(projection),
      { expirationTtl: QR_PUBLIC_PROJECTION_TTL_SECONDS },
    )
  }

  private logWriteFailure(slug: string, error: unknown): void {
    this.dependencies.logger?.warn("QR public projection write failed.", { slug, error })
  }
}

export function qrPublicProjectionKey(slug: string): string {
  return `qr-public:v2:${slug}`
}

export function createQrPublicProjection(record: QrPublicProjectionSource): QrPublicProjection {
  if (record.deletedAt) {
    return {
      schemaVersion: 2,
      slug: record.slug,
      qrCodeId: record.id,
      state: "archived",
      expiresAt: record.expiresAt?.toISOString() ?? null,
      updatedAt: record.updatedAt.toISOString(),
    }
  }

  if (!isQrReady(record) || !record.googlePlaceId || !record.canonicalReviewUrl) {
    return {
      schemaVersion: 2,
      slug: record.slug,
      qrCodeId: record.id,
      state: "setup",
      expiresAt: record.expiresAt?.toISOString() ?? null,
      updatedAt: record.updatedAt.toISOString(),
    }
  }

  return {
    schemaVersion: 2,
    slug: record.slug,
    qrCodeId: record.id,
    state: "active",
    googlePlaceId: record.googlePlaceId,
    canonicalReviewUrl: record.canonicalReviewUrl,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
  }
}

export function isQrReady(record: QrPublicProjectionSource): boolean {
  if (
    !record.rawGoogleMapsUrl ||
    !record.googlePlaceId ||
    !isGooglePlaceId(record.googlePlaceId) ||
    !record.canonicalReviewUrl ||
    !isGoogleCanonicalReviewUrlForPlace(record.canonicalReviewUrl, record.googlePlaceId)
  ) {
    return false
  }

  if (isGoogleMapsShortUrl(record.rawGoogleMapsUrl)) return true

  try {
    const parsed = parseGoogleMapsUrl(record.rawGoogleMapsUrl)
    return parsed.placeId === null || parsed.placeId === record.googlePlaceId
  } catch {
    return false
  }
}

function validateProjection(value: unknown, slug: string): asserts value is QrPublicProjection {
  if (!isRecord(value)) throw new Error("Projection must be an object.")
  if (value.schemaVersion !== 2 || value.slug !== slug || typeof value.qrCodeId !== "string") {
    throw new Error("Projection envelope is invalid.")
  }
  if (
    value.expiresAt !== null &&
    (typeof value.expiresAt !== "string" || Number.isNaN(Date.parse(value.expiresAt)))
  ) {
    throw new Error("Projection expiry is invalid.")
  }
  if (typeof value.updatedAt !== "string" || Number.isNaN(Date.parse(value.updatedAt))) {
    throw new Error("Projection timestamp is invalid.")
  }

  if (value.state === "setup" || value.state === "archived") return
  if (
    value.state !== "active" ||
    typeof value.googlePlaceId !== "string" ||
    !isGooglePlaceId(value.googlePlaceId) ||
    typeof value.canonicalReviewUrl !== "string" ||
    !isGoogleCanonicalReviewUrlForPlace(value.canonicalReviewUrl, value.googlePlaceId)
  ) {
    throw new Error("Active projection target is invalid.")
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
