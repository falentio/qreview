import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import { QrDomainError } from "@/orpc-server/resource/qr/errors"
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
  const clock = { now: () => new Date("2030-01-01T00:00:00.000Z") }
  const service = new QrService({ repository, places, clock })
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
    expect(repository.create.mock.calls).toHaveLength(1)
    expect(repository.create.mock.calls[0]?.[0].target).toEqual({
      rawGoogleMapsUrl: targetUrl,
      googlePlaceId: "ChIJ123456789",
      canonicalReviewUrl: placeDetails.canonicalReviewUrl,
    })
  })
})

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
    })
    await expect(
      service.createOrphan({ actor: owner, alias: "Not allowed" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    })
  })
})

describe("QrService authorization", () => {
  it("does not let organization members manage QR codes", async () => {
    const { repository, service } = setup()
    repository.getOrganizationMemberRole.mockResolvedValue("member")

    await expect(service.list({ actor: owner, organizationId: "org-1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    })
    expect(repository.listForOrganization.mock.calls).toHaveLength(0)
  })
})

describe("QrService target resolution", () => {
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
})

describe("QrService archive and restore", () => {
  it("archives and restores an organization QR code", async () => {
    const { repository, service } = setup()
    const active = createQrRecord()
    const archived = createQrRecord({ deletedAt: new Date("2030-01-02T00:00:00.000Z") })
    repository.findById.mockResolvedValue(active)
    repository.archiveById.mockResolvedValue(archived)
    repository.restoreById.mockResolvedValue(active)

    await expect(
      service.archive({ actor: owner, organizationId: "org-1", id: "qr-1" }),
    ).resolves.toMatchObject({
      deletedAt: "2030-01-02T00:00:00.000Z",
    })
    await expect(
      service.restore({ actor: owner, organizationId: "org-1", id: "qr-1" }),
    ).resolves.toMatchObject({
      deletedAt: null,
    })
  })
})
