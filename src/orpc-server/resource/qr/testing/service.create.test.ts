import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

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
  const clock = { now: () => new Date("2030-01-01T00:00:00.000Z") }
  const ids = {
    generateId: () => "generated-id",
    generateSlug: () => "generated1a",
  }
  const service = new QrService({ repository, places, clock, ids })
  repository.getOrganizationMemberRole.mockResolvedValue("owner")
  places.getPlaceDetails.mockResolvedValue(placeDetails)
  return { repository, places, service }
}

describe("QrService.create", () => {
  it("lets organization members create active QR codes with a server-confirmed target", async () => {
    const { repository, service } = setup()
    repository.create.mockResolvedValue(createQrRecord({ alias: "Trimmed alias" }))

    const result = await service.create({
      actor: owner,
      organizationId: "org-1",
      alias: "  Trimmed alias  ",
      googleMapsUrl: targetUrl,
      googlePlaceId: "ChIJ123456789",
    })

    expect(result.configurationState).toBe("active")
    expect(result.ownershipState).toBe("not-orphan")
    expect(result.claimable).toBe(false)
    expect(repository.create.mock.calls).toHaveLength(1)
    expect(repository.create.mock.calls[0]?.[0]).toMatchObject({
      id: "generated-id",
      slug: "generated1a",
      claimable: false,
    })
    expect(repository.create.mock.calls[0]?.[0].target).toEqual({
      rawGoogleMapsUrl: targetUrl,
      googlePlaceId: "ChIJ123456789",
      canonicalReviewUrl: placeDetails.canonicalReviewUrl,
    })
  })

  it("does not persist a canonical URL for a different Place ID", async () => {
    const { repository, places, service } = setup()
    places.getPlaceDetails.mockResolvedValue({
      ...placeDetails,
      canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ987654321",
    })

    await expect(
      service.create({
        actor: owner,
        organizationId: "org-1",
        alias: "Example location",
        googleMapsUrl: targetUrl,
        googlePlaceId: "ChIJ123456789",
      }),
    ).rejects.toMatchObject({ code: "PLACE_RESOLUTION_FAILED" })
    expect(repository.create.mock.calls).toHaveLength(0)
  })
})
