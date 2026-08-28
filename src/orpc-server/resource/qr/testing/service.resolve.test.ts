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
  return { places, service }
}

describe("QrService.resolve", () => {
  it("returns bounded candidate summaries for an authenticated organization member", async () => {
    const { places, service } = setup()
    places.search.mockResolvedValue([
      { placeId: "ChIJ123456789", name: "Example location", address: "1 Example Street" },
    ])

    await expect(
      service.resolve({
        actor: owner,
        organizationId: "org-1",
        googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Example",
      }),
    ).resolves.toEqual({
      candidates: [
        { placeId: "ChIJ123456789", name: "Example location", address: "1 Example Street" },
      ],
    })
  })
})
