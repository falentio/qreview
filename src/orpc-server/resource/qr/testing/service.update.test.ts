import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import type { PlacesAdapter } from "@/orpc-server/resource/qr/places"
import { createQrRecord, owner } from "@/orpc-server/resource/qr/fixtures"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"
import { QrService } from "@/orpc-server/resource/qr/service"

const targetUrl =
  "https://www.google.com/maps/search/?api=1&query=Example&query_place_id=ChIJ123456789"
const placeDetails = {
  placeId: "ChIJ123456789",
  name: "Example location",
  address: "1 Example Street",
  canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ123456789",
}

function setup() {
  const repository = mock<QrRepository>()
  const places = mock<PlacesAdapter>()
  const service = new QrService({
    repository,
    places,
    clock: { now: () => new Date("2030-01-01T00:00:00.000Z") },
    ids: {
      generateId: () => "generated-id",
      generateSlug: () => "generated1a",
    },
  })
  repository.getOrganizationMemberRole.mockResolvedValue("owner")
  return { repository, places, service }
}

describe("QrService.update", () => {
  it("normalizes an alias and updates an organization QR code", async () => {
    const { repository, service } = setup()
    repository.findById.mockResolvedValue(createQrRecord())
    repository.updateById.mockResolvedValue(createQrRecord({ alias: "Renamed QR" }))

    await expect(
      service.update({
        actor: owner,
        organizationId: "org-1",
        id: "qr-1",
        alias: "  Renamed QR  ",
      }),
    ).resolves.toMatchObject({ alias: "Renamed QR" })
    expect(repository.updateById.mock.calls).toEqual([
      [
        {
          id: "qr-1",
          organizationId: "org-1",
          alias: "Renamed QR",
          target: undefined,
          updatedAt: new Date("2030-01-01T00:00:00.000Z"),
        },
      ],
    ])
  })

  it("resolves and persists a replacement target", async () => {
    const { repository, places, service } = setup()
    repository.findById.mockResolvedValue(createQrRecord())
    repository.updateById.mockResolvedValue(
      createQrRecord({
        rawGoogleMapsUrl: targetUrl,
        googlePlaceId: placeDetails.placeId,
        canonicalReviewUrl: placeDetails.canonicalReviewUrl,
      }),
    )
    places.getPlaceDetails.mockResolvedValue(placeDetails)

    await expect(
      service.update({
        actor: owner,
        organizationId: "org-1",
        id: "qr-1",
        googleMapsUrl: targetUrl,
        googlePlaceId: placeDetails.placeId,
      }),
    ).resolves.toMatchObject({ configurationState: "active" })
    expect(repository.updateById.mock.calls).toEqual([
      [
        {
          id: "qr-1",
          organizationId: "org-1",
          alias: undefined,
          target: {
            rawGoogleMapsUrl: targetUrl,
            googlePlaceId: placeDetails.placeId,
            canonicalReviewUrl: placeDetails.canonicalReviewUrl,
          },
          updatedAt: new Date("2030-01-01T00:00:00.000Z"),
        },
      ],
    ])
  })

  it("rejects an empty update before loading the record", async () => {
    const { repository, service } = setup()

    await expect(
      service.update({ actor: owner, organizationId: "org-1", id: "qr-1" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" })
    expect(repository.findById.mock.calls).toHaveLength(0)
    expect(repository.updateById.mock.calls).toHaveLength(0)
  })

  it("rejects updates to archived or foreign records", async () => {
    const { repository, service } = setup()
    repository.findById.mockResolvedValueOnce(createQrRecord({ deletedAt: new Date() }))

    await expect(
      service.update({ actor: owner, organizationId: "org-1", id: "qr-1", alias: "Archived" }),
    ).rejects.toMatchObject({ code: "ARCHIVED" })

    repository.findById.mockResolvedValueOnce(createQrRecord({ organizationId: "org-2" }))
    await expect(
      service.update({ actor: owner, organizationId: "org-1", id: "qr-1", alias: "Foreign" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect(repository.updateById.mock.calls).toHaveLength(0)
  })

  it("does not mutate an existing QR code when Places resolution fails", async () => {
    const { repository, places, service } = setup()
    repository.findById.mockResolvedValue(createQrRecord())
    places.getPlaceDetails.mockRejectedValue(
      new QrDomainError("PLACE_RESOLUTION_FAILED", "Place not found"),
    )

    await expect(
      service.update({
        actor: owner,
        organizationId: "org-1",
        id: "qr-1",
        googleMapsUrl: targetUrl,
        googlePlaceId: "ChIJ123456789",
      }),
    ).rejects.toMatchObject({ code: "PLACE_RESOLUTION_FAILED" })
    expect(repository.updateById.mock.calls).toHaveLength(0)
  })
})
