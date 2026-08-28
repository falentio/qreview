import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { PlacesAdapter } from "@/orpc-server/resource/qr/places"
import { createQrRecord, owner } from "@/orpc-server/resource/qr/fixtures"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"
import { QrService } from "@/orpc-server/resource/qr/service"

function setup() {
  const repository = mock<QrRepository>()
  const places = mock<PlacesAdapter>()
  const clock = { now: () => new Date("2030-01-01T00:00:00.000Z") }
  const service = new QrService({
    repository,
    places,
    clock,
    ids: {
      generateId: () => "generated-id",
      generateSlug: () => "generated1a",
    },
  })
  repository.getOrganizationMemberRole.mockResolvedValue("owner")
  return { repository, service }
}

describe("QrService.claim", () => {
  it("claims an orphan through the repository's conditional update", async () => {
    const { repository, service } = setup()
    const orphan = createQrRecord({
      organizationId: null,
      googlePlaceId: null,
      canonicalReviewUrl: null,
    })
    const claimed = createQrRecord({
      claimedById: owner.id,
      claimedAt: new Date("2030-01-01T00:00:00.000Z"),
      rawGoogleMapsUrl: null,
      googlePlaceId: null,
      canonicalReviewUrl: null,
    })
    repository.findBySlug.mockResolvedValue(orphan)
    repository.claimBySlug.mockResolvedValue(claimed)

    const result = await service.claim({ actor: owner, slug: orphan.slug, organizationId: "org-1" })

    expect(result.organizationId).toBe("org-1")
    expect(result.configurationState).toBe("incomplete")
    expect(result.claimable).toBe(false)
    expect(repository.claimBySlug.mock.calls[0]?.[0]).toEqual({
      slug: orphan.slug,
      organizationId: "org-1",
      claimedById: owner.id,
      claimedAt: new Date("2030-01-01T00:00:00.000Z"),
      updatedAt: new Date("2030-01-01T00:00:00.000Z"),
    })
  })

  it("reports a race when the conditional claim updates no row", async () => {
    const { repository, service } = setup()
    repository.findBySlug.mockResolvedValue(createQrRecord({ organizationId: null }))
    repository.claimBySlug.mockResolvedValue(null)

    await expect(
      service.claim({ actor: owner, slug: "abc123def4", organizationId: "org-1" }),
    ).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("does not reclaim a QR whose organization was deleted", async () => {
    const { repository, service } = setup()
    repository.findBySlug.mockResolvedValue(
      createQrRecord({
        organizationId: null,
        claimable: false,
      }),
    )

    await expect(
      service.claim({ actor: owner, slug: "abc123def4", organizationId: "org-1" }),
    ).rejects.toMatchObject({ code: "CONFLICT" })
    expect(repository.claimBySlug.mock.calls).toHaveLength(0)
  })
})
