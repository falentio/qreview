import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { PlacesAdapter } from "@/orpc-server/resource/qr/places"
import { createQrRecord } from "@/orpc-server/resource/qr/fixtures"
import type { QrPublicProjectionStore } from "@/orpc-server/resource/qr/public-cache"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"
import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import { QrService } from "@/orpc-server/resource/qr/service"

function setup() {
  const repository = mock<QrRepository>()
  const places = mock<PlacesAdapter>()
  const publicProjection = mock<QrPublicProjectionStore>()
  const service = new QrService({
    repository,
    places,
    publicProjection,
    clock: { now: () => new Date("2030-01-02T00:00:00.000Z") },
    ids: {
      generateId: () => "generated-id",
      generateSlug: () => "generated1a",
    },
  })
  return { publicProjection, repository, service }
}

describe("QrService.resolvePublic", () => {
  it("serves an active KV projection without querying D1", async () => {
    const { publicProjection, repository, service } = setup()
    publicProjection.get.mockResolvedValue({
      schemaVersion: 2,
      slug: "abc123def4",
      qrCodeId: "qr-1",
      state: "active",
      googlePlaceId: "ChIJ123456789",
      canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ123456789",
      expiresAt: null,
      updatedAt: "2030-01-01T00:00:00.000Z",
    })

    await expect(service.resolvePublic({ slug: "abc123def4" })).resolves.toEqual({
      kind: "redirect",
      qrCodeId: "qr-1",
      canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ123456789",
    })
    expect(repository.findBySlug.mock.calls).toHaveLength(0)
  })

  it("serves setup and archived states from KV without querying D1", async () => {
    const { publicProjection, repository, service } = setup()

    publicProjection.get.mockResolvedValueOnce({
      schemaVersion: 2,
      slug: "abc123def4",
      qrCodeId: "qr-1",
      state: "setup",
      expiresAt: null,
      updatedAt: "2030-01-01T00:00:00.000Z",
    })
    await expect(service.resolvePublic({ slug: "abc123def4" })).resolves.toEqual({ kind: "setup" })

    publicProjection.get.mockResolvedValueOnce({
      schemaVersion: 2,
      slug: "abc123def4",
      qrCodeId: "qr-1",
      state: "archived",
      expiresAt: null,
      updatedAt: "2030-01-01T00:00:00.000Z",
    })
    await expect(service.resolvePublic({ slug: "abc123def4" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    })

    expect(repository.findBySlug.mock.calls).toHaveLength(0)
  })

  it("returns expired for an expired KV projection without querying D1", async () => {
    const { publicProjection, repository, service } = setup()
    publicProjection.get.mockResolvedValue({
      schemaVersion: 2,
      slug: "abc123def4",
      qrCodeId: "qr-1",
      state: "active",
      googlePlaceId: "ChIJ123456789",
      canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ123456789",
      expiresAt: "2030-01-02T00:00:00.000Z",
      updatedAt: "2030-01-01T00:00:00.000Z",
    })

    await expect(service.resolvePublic({ slug: "abc123def4" })).resolves.toEqual({
      kind: "expired",
    })
    expect(repository.findBySlug.mock.calls).toHaveLength(0)
  })

  it("falls back to D1 and publishes an active projection on a cache miss", async () => {
    const { publicProjection, repository, service } = setup()
    const record = createQrRecord()
    publicProjection.get.mockResolvedValue(null)
    repository.findBySlug.mockResolvedValue(record)

    await expect(service.resolvePublic({ slug: record.slug })).resolves.toMatchObject({
      kind: "redirect",
      qrCodeId: record.id,
    })
    expect(publicProjection.set.mock.calls).toEqual([
      [
        {
          schemaVersion: 2,
          slug: record.slug,
          qrCodeId: record.id,
          state: "active",
          googlePlaceId: record.googlePlaceId,
          canonicalReviewUrl: record.canonicalReviewUrl,
          expiresAt: null,
          updatedAt: record.updatedAt.toISOString(),
        },
      ],
    ])
  })

  it("returns a temporary unavailable error when D1 fails after a cache miss", async () => {
    const { publicProjection, repository, service } = setup()
    publicProjection.get.mockResolvedValue(null)
    repository.findBySlug.mockRejectedValue(new Error("D1 unavailable"))

    await expect(service.resolvePublic({ slug: "abc123def4" })).rejects.toMatchObject({
      code: "PUBLIC_UNAVAILABLE",
      httpCode: "SERVICE_UNAVAILABLE",
    } satisfies Partial<QrDomainError>)
  })

  it("does not cache unknown slugs", async () => {
    const { publicProjection, repository, service } = setup()
    publicProjection.get.mockResolvedValue(null)
    repository.findBySlug.mockResolvedValue(null)

    await expect(service.resolvePublic({ slug: "abc123def4" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    })
    expect(publicProjection.set.mock.calls).toHaveLength(0)
  })

  it("publishes an archived tombstone when D1 identifies an archived QR", async () => {
    const { publicProjection, repository, service } = setup()
    const record = createQrRecord({ deletedAt: new Date("2030-01-02T00:00:00.000Z") })
    publicProjection.get.mockResolvedValue(null)
    repository.findBySlug.mockResolvedValue(record)

    await expect(service.resolvePublic({ slug: record.slug })).rejects.toMatchObject({
      code: "NOT_FOUND",
    })
    expect(publicProjection.set.mock.calls).toEqual([
      [
        {
          schemaVersion: 2,
          slug: record.slug,
          qrCodeId: record.id,
          state: "archived",
          expiresAt: record.expiresAt?.toISOString() ?? null,
          updatedAt: record.updatedAt.toISOString(),
        },
      ],
    ])
  })

  it("returns expired for a D1 record and publishes its expiry", async () => {
    const { publicProjection, repository, service } = setup()
    const record = createQrRecord({ expiresAt: new Date("2030-01-02T00:00:00.000Z") })
    publicProjection.get.mockResolvedValue(null)
    repository.findBySlug.mockResolvedValue(record)

    await expect(service.resolvePublic({ slug: record.slug })).resolves.toEqual({
      kind: "expired",
    })
    expect(publicProjection.set.mock.calls).toEqual([
      [
        expect.objectContaining({
          state: "active",
          expiresAt: "2030-01-02T00:00:00.000Z",
        }),
      ],
    ])
  })
})
