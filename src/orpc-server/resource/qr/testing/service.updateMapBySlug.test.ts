import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import {
  createQrRecord,
  globalAdmin,
  googleCanonicalReviewUrl,
  googleMapsUrl,
  googlePlaceId,
  owner,
} from "@/orpc-server/resource/qr/fixtures"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"
import { QrService } from "@/orpc-server/resource/qr/service"

function setup() {
  const repository = mock<QrRepository>()
  const service = new QrService({
    repository,
    clock: { now: () => new Date("2030-01-01T00:00:00.000Z") },
    ids: {
      generateId: () => "generated-id",
      generateSlug: () => "generated1a",
    },
  })
  return { repository, service }
}

describe("QrService.updateMapBySlug", () => {
  it("lets a global admin configure an orphan by slug without adopting it", async () => {
    const { repository, service } = setup()
    repository.findBySlug.mockResolvedValue(
      createQrRecord({
        slug: "abc123def4",
        organizationId: null,
        rawGoogleMapsUrl: null,
        googlePlaceId: null,
        canonicalReviewUrl: null,
      }),
    )
    repository.updateMapBySlug.mockResolvedValue(
      createQrRecord({
        slug: "abc123def4",
        organizationId: null,
        rawGoogleMapsUrl: googleMapsUrl,
        googlePlaceId,
        canonicalReviewUrl: googleCanonicalReviewUrl,
      }),
    )

    await expect(
      service.updateMapBySlug({
        actor: globalAdmin,
        slug: "abc123def4",
        googleMapsUrl,
        googlePlaceId,
      }),
    ).resolves.toMatchObject({
      slug: "abc123def4",
      organizationId: null,
      configurationState: "active",
    })

    expect(repository.updateMapBySlug.mock.calls).toEqual([
      [
        {
          slug: "abc123def4",
          target: {
            rawGoogleMapsUrl: googleMapsUrl,
            googlePlaceId,
            canonicalReviewUrl: googleCanonicalReviewUrl,
          },
          updatedAt: new Date("2030-01-01T00:00:00.000Z"),
        },
      ],
    ])
  })

  it("rejects non-global-admins without loading or changing the QR code", async () => {
    const { repository, service } = setup()

    await expect(
      service.updateMapBySlug({
        actor: owner,
        slug: "abc123def4",
        googleMapsUrl,
        googlePlaceId,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(repository.findBySlug.mock.calls).toHaveLength(0)
    expect(repository.updateMapBySlug.mock.calls).toHaveLength(0)
  })

  it("does not update an archived QR code", async () => {
    const { repository, service } = setup()
    repository.findBySlug.mockResolvedValue(createQrRecord({ deletedAt: new Date() }))

    await expect(
      service.updateMapBySlug({
        actor: globalAdmin,
        slug: "abc123def4",
        googleMapsUrl,
        googlePlaceId,
      }),
    ).rejects.toMatchObject({ code: "ARCHIVED" } satisfies Partial<QrDomainError>)
    expect(repository.updateMapBySlug.mock.calls).toHaveLength(0)
  })
})

describe("QrService.verifyBySlug", () => {
  it("confirms an active QR code for a global admin", async () => {
    const { repository, service } = setup()
    repository.findBySlug.mockResolvedValue(createQrRecord({ slug: "abc123def4" }))

    await expect(service.verifyBySlug({ actor: globalAdmin, slug: "abc123def4" })).resolves.toEqual(
      { slug: "abc123def4", expiresAt: null },
    )
  })

  it("rejects archived QR codes", async () => {
    const { repository, service } = setup()
    repository.findBySlug.mockResolvedValue(createQrRecord({ deletedAt: new Date() }))

    await expect(
      service.verifyBySlug({ actor: globalAdmin, slug: "abc123def4" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" } satisfies Partial<QrDomainError>)
  })
})
