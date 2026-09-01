import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { AppLogger } from "@/lib/logging"
import type { PlacesAdapter } from "@/orpc-server/resource/qr/places"
import { createQrRecord, globalAdmin, owner } from "@/orpc-server/resource/qr/fixtures"
import type { QrPublicProjectionStore } from "@/orpc-server/resource/qr/public-cache"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"
import { QrService } from "@/orpc-server/resource/qr/service"

function setup() {
  const repository = mock<QrRepository>()
  const places = mock<PlacesAdapter>()
  const publicProjection = mock<QrPublicProjectionStore>()
  const logger = { warn: vi.fn() } as Pick<AppLogger, "warn">
  const service = new QrService({
    repository,
    places,
    publicProjection,
    clock: { now: () => new Date("2030-01-01T00:00:00.000Z") },
    ids: {
      generateId: () => "generated-id",
      generateSlug: () => "generated1a",
    },
    logger,
  })
  repository.getOrganizationMemberRole.mockResolvedValue("owner")
  return { logger, publicProjection, repository, service }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("QrService public projection publication", () => {
  it("publishes the projection after creating a QR code", async () => {
    const { publicProjection, repository, service } = setup()
    const created = createQrRecord({ id: "created-qr", slug: "created1234" })
    repository.create.mockResolvedValue(created)

    await service.createOrphan({ actor: { id: "admin-1", role: "admin" }, alias: "New QR" })

    expect(publicProjection.set.mock.calls).toEqual([
      [
        {
          schemaVersion: 2,
          slug: created.slug,
          qrCodeId: created.id,
          state: "active",
          googlePlaceId: created.googlePlaceId,
          canonicalReviewUrl: created.canonicalReviewUrl,
          expiresAt: created.expiresAt?.toISOString() ?? null,
          updatedAt: created.updatedAt.toISOString(),
        },
      ],
    ])
  })

  it("publishes the projection after updating a QR code", async () => {
    const { publicProjection, repository, service } = setup()
    const existing = createQrRecord()
    const updated = createQrRecord({ alias: "Updated QR" })
    repository.findById.mockResolvedValue(existing)
    repository.updateById.mockResolvedValue(updated)

    await service.update({
      actor: owner,
      organizationId: "org-1",
      id: existing.id,
      alias: "Updated QR",
    })

    expect(publicProjection.set.mock.calls).toEqual([
      [
        expect.objectContaining({
          slug: updated.slug,
          qrCodeId: updated.id,
          state: "active",
        }),
      ],
    ])
  })

  it("publishes the projection after updating expiry", async () => {
    const { publicProjection, repository, service } = setup()
    const existing = createQrRecord()
    const updated = createQrRecord({ expiresAt: new Date("2030-02-01T00:00:00.000Z") })
    repository.findBySlug.mockResolvedValue(existing)
    repository.setExpirationBySlug.mockResolvedValue(updated)
    const setAndWait = vi.fn(async () => undefined)
    publicProjection.setAndWait = setAndWait

    await service.setExpirationBySlug({
      actor: globalAdmin,
      slug: existing.slug,
      expiresAt: "2030-02-01T00:00:00.000Z",
    })

    expect(setAndWait.mock.calls).toEqual([
      [
        expect.objectContaining({
          slug: updated.slug,
          qrCodeId: updated.id,
          state: "active",
          expiresAt: "2030-02-01T00:00:00.000Z",
        }),
      ],
    ])
    expect(publicProjection.set.mock.calls).toHaveLength(0)
  })

  it("publishes an archived tombstone after archiving a QR code", async () => {
    const { publicProjection, repository, service } = setup()
    const archived = createQrRecord({ deletedAt: new Date("2030-01-01T00:00:00.000Z") })
    repository.findById.mockResolvedValue(createQrRecord())
    repository.archiveById.mockResolvedValue(archived)

    await service.archive({ actor: owner, organizationId: "org-1", id: archived.id })

    expect(publicProjection.set.mock.calls).toEqual([
      [
        {
          schemaVersion: 2,
          slug: archived.slug,
          qrCodeId: archived.id,
          state: "archived",
          expiresAt: archived.expiresAt?.toISOString() ?? null,
          updatedAt: archived.updatedAt.toISOString(),
        },
      ],
    ])
  })

  it("publishes the restored routing state after restoring a QR code", async () => {
    const { publicProjection, repository, service } = setup()
    const restored = createQrRecord({ deletedAt: null })
    repository.findById.mockResolvedValue(createQrRecord({ deletedAt: new Date() }))
    repository.restoreById.mockResolvedValue(restored)

    await service.restore({ actor: owner, organizationId: "org-1", id: restored.id })

    expect(publicProjection.set.mock.calls).toEqual([
      [
        expect.objectContaining({
          slug: restored.slug,
          qrCodeId: restored.id,
          state: "active",
        }),
      ],
    ])
  })

  it("does not fail a successful mutation when projection publication throws", async () => {
    const { logger, publicProjection, repository, service } = setup()
    const updated = createQrRecord({ alias: "Updated QR" })
    repository.findById.mockResolvedValue(createQrRecord())
    repository.updateById.mockResolvedValue(updated)
    publicProjection.set.mockImplementation(() => {
      throw new Error("KV unavailable")
    })
    await expect(
      service.update({
        actor: owner,
        organizationId: "org-1",
        id: updated.id,
        alias: updated.alias,
      }),
    ).resolves.toMatchObject({ alias: updated.alias })
    expect(logger.warn).toHaveBeenCalledWith("QR public projection publication failed.", {
      slug: updated.slug,
      error: expect.any(Error),
    })
  })
})
