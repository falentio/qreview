import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import type { PlacesAdapter } from "@/orpc-server/resource/qr/places"
import { createQrRecord, owner } from "@/orpc-server/resource/qr/fixtures"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"
import { QrService } from "@/orpc-server/resource/qr/service"

const targetUrl =
  "https://www.google.com/maps/search/?api=1&query=Example&query_place_id=ChIJ123456789"

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
