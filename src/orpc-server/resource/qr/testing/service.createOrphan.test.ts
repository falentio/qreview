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
    ids: {
      generateId: () => "generated-id",
      generateSlug: () => "generated1a",
    },
  })
  repository.getOrganizationMemberRole.mockResolvedValue("owner")
  places.getPlaceDetails.mockResolvedValue(placeDetails)
  return { repository, service }
}

describe("QrService.createOrphan", () => {
  it("allows only global Better Auth admins to create orphan placeholders", async () => {
    const { repository, service } = setup()
    repository.create.mockResolvedValue(
      createQrRecord({
        alias: "Unclaimed sign",
        organizationId: null,
        rawGoogleMapsUrl: null,
        googlePlaceId: null,
        canonicalReviewUrl: null,
      }),
    )

    const result = await service.createOrphan({ actor: globalAdmin, alias: "  Unclaimed sign  " })

    expect(result).toMatchObject({
      alias: "Unclaimed sign",
      ownershipState: "orphan",
      configurationState: "incomplete",
      claimable: true,
    })
    expect(repository.create.mock.calls[0]?.[0]).toMatchObject({
      id: "generated-id",
      slug: "generated1a",
      alias: "Unclaimed sign",
      organizationId: null,
      createdById: globalAdmin.id,
      claimedById: null,
      claimedAt: null,
      claimable: true,
      deletedAt: null,
    })
    expect(repository.create.mock.calls[0]?.[0].target).toBeUndefined()
    await expect(
      service.createOrphan({ actor: owner, alias: "Not allowed" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    })
  })

  it("preserves an optional preconfigured target on an orphan", async () => {
    const { repository, service } = setup()
    repository.create.mockResolvedValue(createQrRecord({ organizationId: null }))

    const result = await service.createOrphan({
      actor: globalAdmin,
      alias: "Configured sign",
      googleMapsUrl: targetUrl,
      googlePlaceId: "ChIJ123456789",
    })

    expect(result).toMatchObject({
      ownershipState: "orphan",
      configurationState: "active",
      claimable: true,
    })
    expect(repository.create.mock.calls[0]?.[0]).toMatchObject({
      alias: "Configured sign",
      organizationId: null,
      createdById: globalAdmin.id,
      claimable: true,
    })
    expect(repository.create.mock.calls).toHaveLength(1)
    expect(repository.create.mock.calls[0]?.[0].target).toEqual({
      rawGoogleMapsUrl: targetUrl,
      googlePlaceId: "ChIJ123456789",
      canonicalReviewUrl: placeDetails.canonicalReviewUrl,
    })
  })
})
