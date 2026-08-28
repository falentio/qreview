import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { PlacesAdapter } from "@/orpc-server/resource/qr/places"
import { createQrRecord, globalAdmin, owner } from "@/orpc-server/resource/qr/fixtures"
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
      generateId: (() => {
        let count = 0
        return () => `generated-id-${++count}`
      })(),
      generateSlug: (() => {
        let count = 0
        return () => `abc123def${count++}`
      })(),
    },
  })
  places.getPlaceDetails.mockResolvedValue(placeDetails)
  return { places, repository, service }
}

describe("QrService.batchCreate", () => {
  it("creates identical configured QR codes for a global admin", async () => {
    const { places, repository, service } = setup()
    const created = [
      createQrRecord({ id: "qr-1", slug: "abc123def4", alias: "Batch QR 1" }),
      createQrRecord({ id: "qr-2", slug: "abc123def5", alias: "Batch QR 2" }),
      createQrRecord({ id: "qr-3", slug: "abc123def6", alias: "Batch QR 3" }),
    ]
    let createdIndex = 0
    repository.create.mockImplementation(async () => created[createdIndex++]!)

    const result = await service.batchCreate({
      actor: globalAdmin,
      organizationId: "org-1",
      alias: "  Batch QR  ",
      googleMapsUrl: targetUrl,
      googlePlaceId: placeDetails.placeId,
      count: 3,
    })

    expect(result.items).toHaveLength(3)
    expect(places.getPlaceDetails.mock.calls).toEqual([[{ placeId: placeDetails.placeId }]])
    expect(repository.create.mock.calls).toHaveLength(3)
    expect(repository.create.mock.calls.map(([input]) => input)).toMatchObject([
      {
        id: "generated-id-1",
        alias: "Batch QR",
        organizationId: "org-1",
        createdById: globalAdmin.id,
        claimable: false,
        target: {
          rawGoogleMapsUrl: targetUrl,
          googlePlaceId: placeDetails.placeId,
          canonicalReviewUrl: placeDetails.canonicalReviewUrl,
        },
      },
      {
        id: "generated-id-2",
        alias: "Batch QR",
        organizationId: "org-1",
        createdById: globalAdmin.id,
        claimable: false,
      },
      {
        id: "generated-id-3",
        alias: "Batch QR",
        organizationId: "org-1",
        createdById: globalAdmin.id,
        claimable: false,
      },
    ])
    expect(repository.create.mock.calls.map(([input]) => input.slug)).toEqual([
      "abc123def0",
      "abc123def1",
      "abc123def2",
    ])
  })

  it("rejects non-admins and invalid counts before resolving or persisting", async () => {
    const { places, repository, service } = setup()

    await expect(
      service.batchCreate({
        actor: owner,
        organizationId: "org-1",
        alias: "Batch QR",
        googleMapsUrl: targetUrl,
        googlePlaceId: placeDetails.placeId,
        count: 2,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })

    await expect(
      service.batchCreate({
        actor: globalAdmin,
        organizationId: "org-1",
        alias: "Batch QR",
        googleMapsUrl: targetUrl,
        googlePlaceId: placeDetails.placeId,
        count: 0,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" })

    expect(places.getPlaceDetails.mock.calls).toHaveLength(0)
    expect(repository.create.mock.calls).toHaveLength(0)
  })
})
