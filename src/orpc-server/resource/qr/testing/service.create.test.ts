import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import {
  createQrRecord,
  googleCanonicalReviewUrl,
  googleMapsUrl,
  googlePlaceId,
  owner,
} from "@/orpc-server/resource/qr/fixtures"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"
import { QrService } from "@/orpc-server/resource/qr/service"

function setup() {
  const repository = mock<QrRepository>()
  const clock = { now: () => new Date("2030-01-01T00:00:00.000Z") }
  const ids = {
    generateId: () => "generated-id",
    generateSlug: () => "generated1a",
  }
  const service = new QrService({ repository, clock, ids })
  repository.getOrganizationMemberRole.mockResolvedValue("owner")
  return { repository, service }
}

describe("QrService.create", () => {
  it("lets organization members create active QR codes with a locally resolved target", async () => {
    const { repository, service } = setup()
    repository.create.mockResolvedValue(createQrRecord({ alias: "Trimmed alias" }))

    const result = await service.create({
      actor: owner,
      organizationId: "org-1",
      alias: "  Trimmed alias  ",
      googleMapsUrl,
      googlePlaceId,
    })

    expect(result.configurationState).toBe("active")
    expect(result.ownershipState).toBe("not-orphan")
    expect(result.claimable).toBe(false)
    expect(repository.create.mock.calls).toHaveLength(1)
    expect(repository.create.mock.calls[0]?.[0]).toMatchObject({
      id: "generated-id",
      slug: "generated1a",
      alias: "Trimmed alias",
      organizationId: "org-1",
      createdById: owner.id,
      claimable: false,
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
      updatedAt: new Date("2030-01-01T00:00:00.000Z"),
    })
    expect(repository.create.mock.calls[0]?.[0].target).toEqual({
      rawGoogleMapsUrl: googleMapsUrl,
      googlePlaceId,
      canonicalReviewUrl: googleCanonicalReviewUrl,
    })
  })

  it("rejects a query URL without a specific place ID", async () => {
    const { repository, service } = setup()

    await expect(
      service.create({
        actor: owner,
        organizationId: "org-1",
        alias: "Example location",
        googleMapsUrl: "https://www.google.com/maps/search/?query=%20Example%20",
        googlePlaceId,
      }),
    ).rejects.toMatchObject({ code: "PLACE_RESOLUTION_FAILED" })
    expect(repository.create.mock.calls).toHaveLength(0)
  })

  it("retries a generated slug after a slug conflict", async () => {
    const { repository, service } = setup()
    repository.create
      .mockRejectedValueOnce(new QrDomainError("SLUG_CONFLICT", "Slug already exists."))
      .mockResolvedValueOnce(createQrRecord({ alias: "Trimmed alias" }))

    await expect(
      service.create({
        actor: owner,
        organizationId: "org-1",
        alias: "Trimmed alias",
        googleMapsUrl,
        googlePlaceId,
      }),
    ).resolves.toMatchObject({ alias: "Trimmed alias" })
    expect(repository.create.mock.calls).toHaveLength(2)
  })

  it("rejects an invalid alias before resolving or persisting its target", async () => {
    const { repository, service } = setup()

    await expect(
      service.create({
        actor: owner,
        organizationId: "org-1",
        alias: "   ",
        googleMapsUrl,
        googlePlaceId,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" })
    expect(repository.create.mock.calls).toHaveLength(0)
  })

  it("rejects a target when its selected Place ID differs from the URL", async () => {
    const { repository, service } = setup()

    await expect(
      service.create({
        actor: owner,
        organizationId: "org-1",
        alias: "Example location",
        googleMapsUrl,
        googlePlaceId: "ChIJ987654321",
      }),
    ).rejects.toMatchObject({ code: "PLACE_RESOLUTION_FAILED" })
    expect(repository.create.mock.calls).toHaveLength(0)
  })
})
