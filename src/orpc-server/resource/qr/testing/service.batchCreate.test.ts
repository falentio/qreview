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
  return { repository, service }
}

describe("QrService.batchCreate", () => {
  it("creates identical configured QR codes for a global admin", async () => {
    const { repository, service } = setup()
    const created = [
      createQrRecord({
        id: "qr-1",
        slug: "abc123def4",
        alias: "Batch QR 1",
        expiresAt: new Date("2030-02-01T00:00:00.000Z"),
      }),
      createQrRecord({
        id: "qr-2",
        slug: "abc123def5",
        alias: "Batch QR 2",
        expiresAt: new Date("2030-02-01T00:00:00.000Z"),
      }),
      createQrRecord({
        id: "qr-3",
        slug: "abc123def6",
        alias: "Batch QR 3",
        expiresAt: new Date("2030-02-01T00:00:00.000Z"),
      }),
    ]
    let createdIndex = 0
    repository.create.mockImplementation(async () => created[createdIndex++]!)

    const result = await service.batchCreate({
      actor: globalAdmin,
      organizationId: "org-1",
      alias: "  Batch QR  ",
      googleMapsUrl,
      googlePlaceId,
      count: 3,
      expiresAt: "2030-02-01T00:00:00.000Z",
    })

    expect(result.items).toHaveLength(3)
    expect(repository.create.mock.calls).toHaveLength(3)
    expect(repository.create.mock.calls.map(([input]) => input)).toMatchObject([
      {
        id: "generated-id-1",
        alias: "Batch QR",
        organizationId: "org-1",
        createdById: globalAdmin.id,
        claimable: false,
        expiresAt: new Date("2030-02-01T00:00:00.000Z"),
        target: {
          rawGoogleMapsUrl: googleMapsUrl,
          googlePlaceId,
          canonicalReviewUrl: googleCanonicalReviewUrl,
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

  it("creates configured orphan QR codes without an organization", async () => {
    const { repository, service } = setup()
    const created = [
      createQrRecord({
        id: "qr-1",
        slug: "abc123def4",
        organizationId: null,
        expiresAt: new Date("2030-02-01T00:00:00.000Z"),
      }),
      createQrRecord({
        id: "qr-2",
        slug: "abc123def5",
        organizationId: null,
        expiresAt: new Date("2030-02-01T00:00:00.000Z"),
      }),
    ]
    let createdIndex = 0
    repository.create.mockImplementation(async () => created[createdIndex++]!)

    const result = await service.batchCreateOrphan({
      actor: globalAdmin,
      alias: "  Unclaimed QR  ",
      googleMapsUrl,
      googlePlaceId,
      count: 2,
      expiresAt: "2030-02-01T00:00:00.000Z",
    })

    expect(result.items).toMatchObject([
      {
        ownershipState: "orphan",
        configurationState: "active",
        claimable: true,
        expiresAt: "2030-02-01T00:00:00.000Z",
      },
      {
        ownershipState: "orphan",
        configurationState: "active",
        claimable: true,
      },
    ])
    expect(repository.create.mock.calls.map(([input]) => input)).toMatchObject([
      {
        alias: "Unclaimed QR",
        organizationId: null,
        claimable: true,
        target: {
          rawGoogleMapsUrl: googleMapsUrl,
          googlePlaceId,
          canonicalReviewUrl: googleCanonicalReviewUrl,
        },
      },
      { alias: "Unclaimed QR", organizationId: null, claimable: true },
    ])
  })

  it("creates incomplete orphan QR codes without a target", async () => {
    const { repository, service } = setup()
    repository.create.mockResolvedValue(
      createQrRecord({
        alias: "Unconfigured QR",
        organizationId: null,
        rawGoogleMapsUrl: null,
        googlePlaceId: null,
        canonicalReviewUrl: null,
      }),
    )

    const result = await service.batchCreateOrphan({
      actor: globalAdmin,
      alias: "  Unconfigured QR  ",
      count: 2,
    })

    expect(result.items).toMatchObject([
      {
        alias: "Unconfigured QR",
        ownershipState: "orphan",
        configurationState: "incomplete",
        claimable: true,
      },
      {
        alias: "Unconfigured QR",
        ownershipState: "orphan",
        configurationState: "incomplete",
        claimable: true,
      },
    ])
    expect(repository.create.mock.calls.map(([input]) => input.target)).toEqual([
      undefined,
      undefined,
    ])
  })

  it("rejects non-admins and invalid counts before resolving or persisting", async () => {
    const { repository, service } = setup()

    await expect(
      service.batchCreate({
        actor: owner,
        organizationId: "org-1",
        alias: "Batch QR",
        googleMapsUrl,
        googlePlaceId,
        count: 2,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })

    await expect(
      service.batchCreate({
        actor: globalAdmin,
        organizationId: "org-1",
        alias: "Batch QR",
        googleMapsUrl,
        googlePlaceId,
        count: 0,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" })

    expect(repository.create.mock.calls).toHaveLength(0)
  })
})
