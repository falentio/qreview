import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import type { PlacesAdapter } from "@/orpc-server/resource/qr/places"
import { createQrRecord, globalAdmin, owner } from "@/orpc-server/resource/qr/fixtures"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"
import { QrService } from "@/orpc-server/resource/qr/service"

const targetUrl =
  "https://www.google.com/maps/search/?api=1&query=Updated&query_place_id=ChIJ987654321"
const placeDetails = {
  placeId: "ChIJ987654321",
  name: "Updated location",
  address: "2 Example Street",
  canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ987654321",
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
  places.getPlaceDetails.mockResolvedValue(placeDetails)
  return { places, repository, service }
}

describe("QrService.updateMapBySlug", () => {
  it("lets a global admin configure an orphan by slug without adopting it", async () => {
    const { places, repository, service } = setup()
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
        rawGoogleMapsUrl: targetUrl,
        googlePlaceId: placeDetails.placeId,
        canonicalReviewUrl: placeDetails.canonicalReviewUrl,
      }),
    )

    await expect(
      service.updateMapBySlug({
        actor: globalAdmin,
        slug: "abc123def4",
        googleMapsUrl: targetUrl,
        googlePlaceId: placeDetails.placeId,
      }),
    ).resolves.toMatchObject({
      slug: "abc123def4",
      organizationId: null,
      configurationState: "active",
    })

    expect(places.getPlaceDetails.mock.calls).toEqual([[{ placeId: placeDetails.placeId }]])
    expect(repository.updateMapBySlug.mock.calls).toEqual([
      [
        {
          slug: "abc123def4",
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

  it("rejects non-global-admins without loading or changing the QR code", async () => {
    const { places, repository, service } = setup()

    await expect(
      service.updateMapBySlug({
        actor: owner,
        slug: "abc123def4",
        googleMapsUrl: targetUrl,
        googlePlaceId: placeDetails.placeId,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(places.getPlaceDetails.mock.calls).toHaveLength(0)
    expect(repository.findBySlug.mock.calls).toHaveLength(0)
    expect(repository.updateMapBySlug.mock.calls).toHaveLength(0)
  })

  it("does not update an archived QR code", async () => {
    const { places, repository, service } = setup()
    repository.findBySlug.mockResolvedValue(createQrRecord({ deletedAt: new Date() }))

    await expect(
      service.updateMapBySlug({
        actor: globalAdmin,
        slug: "abc123def4",
        googleMapsUrl: targetUrl,
        googlePlaceId: placeDetails.placeId,
      }),
    ).rejects.toMatchObject({ code: "ARCHIVED" } satisfies Partial<QrDomainError>)
    expect(places.getPlaceDetails.mock.calls).toHaveLength(0)
    expect(repository.updateMapBySlug.mock.calls).toHaveLength(0)
  })
})

describe("QrService.verifyBySlug", () => {
  it("confirms an active QR code for a global admin", async () => {
    const { repository, service } = setup()
    repository.findBySlug.mockResolvedValue(createQrRecord({ slug: "abc123def4" }))

    await expect(service.verifyBySlug({ actor: globalAdmin, slug: "abc123def4" })).resolves.toEqual(
      { slug: "abc123def4" },
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
