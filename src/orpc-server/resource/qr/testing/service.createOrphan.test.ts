import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import {
  createQrRecord,
  globalAdmin,
  googleCanonicalReviewUrl,
  googleMapsUrl,
  googlePlaceId,
  owner,
} from "@/orpc-server/resource/qr/fixtures"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"
import { QrService } from "@/orpc-server/resource/qr/service"

function setup() {
  const repository = mock<QrRepository>()
  const service = new QrService({
    repository,
    ids: {
      generateId: () => "generated-id",
      generateSlug: () => "generated1a",
    },
  })
  repository.getOrganizationMemberRole.mockResolvedValue("owner")
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
        expiresAt: new Date("2030-02-01T00:00:00.000Z"),
      }),
    )

    const result = await service.createOrphan({
      actor: globalAdmin,
      alias: "  Unclaimed sign  ",
      expiresAt: "2030-02-01T00:00:00.000Z",
    })

    expect(result).toMatchObject({
      alias: "Unclaimed sign",
      ownershipState: "orphan",
      configurationState: "incomplete",
      claimable: true,
      expiresAt: "2030-02-01T00:00:00.000Z",
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
      googleMapsUrl,
      googlePlaceId,
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
      rawGoogleMapsUrl: googleMapsUrl,
      googlePlaceId,
      canonicalReviewUrl: googleCanonicalReviewUrl,
    })
  })

  it("rejects invalid expiry dates before resolving or persisting", async () => {
    const { repository, service } = setup()

    await expect(
      service.createOrphan({
        actor: globalAdmin,
        alias: "Invalid expiry",
        expiresAt: "not-a-date",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" })
    expect(repository.create.mock.calls).toHaveLength(0)
  })
})
