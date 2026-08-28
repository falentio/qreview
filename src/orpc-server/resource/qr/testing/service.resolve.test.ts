import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { PlacesAdapter } from "@/orpc-server/resource/qr/places"
import { owner } from "@/orpc-server/resource/qr/fixtures"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"
import { QrService } from "@/orpc-server/resource/qr/service"

function setup() {
  const repository = mock<QrRepository>()
  const places = mock<PlacesAdapter>()
  const service = new QrService({
    repository,
    places,
    ids: {
      generateId: () => "generated-id",
      generateSlug: () => "generated1a",
    },
  })
  repository.getOrganizationMemberRole.mockResolvedValue("owner")
  return { places, repository, service }
}

describe("QrService.resolve", () => {
  it("returns the first five search candidates for an authenticated organization member", async () => {
    const { places, repository, service } = setup()
    places.search.mockResolvedValue([
      { placeId: "ChIJ123456780", name: "Example location 0", address: "0 Example Street" },
      { placeId: "ChIJ123456781", name: "Example location 1", address: "1 Example Street" },
      { placeId: "ChIJ123456782", name: "Example location 2", address: "2 Example Street" },
      { placeId: "ChIJ123456783", name: "Example location 3", address: "3 Example Street" },
      { placeId: "ChIJ123456784", name: "Example location 4", address: "4 Example Street" },
      { placeId: "ChIJ123456785", name: "Example location 5", address: "5 Example Street" },
    ])

    await expect(
      service.resolve({
        actor: owner,
        organizationId: "org-1",
        googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Example",
      }),
    ).resolves.toEqual({
      candidates: [
        { placeId: "ChIJ123456780", name: "Example location 0", address: "0 Example Street" },
        { placeId: "ChIJ123456781", name: "Example location 1", address: "1 Example Street" },
        { placeId: "ChIJ123456782", name: "Example location 2", address: "2 Example Street" },
        { placeId: "ChIJ123456783", name: "Example location 3", address: "3 Example Street" },
        { placeId: "ChIJ123456784", name: "Example location 4", address: "4 Example Street" },
      ],
    })
    expect(repository.getOrganizationMemberRole.mock.calls).toEqual([
      [
        {
          organizationId: "org-1",
          userId: owner.id,
        },
      ],
    ])
    expect(places.search.mock.calls).toEqual([[{ query: "Example" }]])
  })

  it("confirms a place ID directly without searching", async () => {
    const { places, repository, service } = setup()
    places.getPlaceDetails.mockResolvedValue({
      placeId: "ChIJ123456789",
      name: "Example location",
      address: "1 Example Street",
      canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ123456789",
    })

    await expect(
      service.resolve({
        actor: owner,
        organizationId: "org-1",
        googleMapsUrl:
          "https://www.google.com/maps/search/?query=Example&query_place_id=ChIJ123456789",
      }),
    ).resolves.toEqual({
      candidates: [
        { placeId: "ChIJ123456789", name: "Example location", address: "1 Example Street" },
      ],
    })
    expect(places.getPlaceDetails.mock.calls).toEqual([[{ placeId: "ChIJ123456789" }]])
    expect(places.search.mock.calls).toHaveLength(0)
    expect(repository.getOrganizationMemberRole.mock.calls).toHaveLength(1)
  })

  it("rejects a valid Maps URL when Places finds no candidates", async () => {
    const { places, service } = setup()
    places.search.mockResolvedValue([])

    await expect(
      service.resolve({
        actor: owner,
        organizationId: "org-1",
        googleMapsUrl: "https://www.google.com/maps/search/?query=Unknown",
      }),
    ).rejects.toMatchObject({
      code: "PLACE_RESOLUTION_FAILED",
      httpCode: "BAD_REQUEST",
    })
  })
})
