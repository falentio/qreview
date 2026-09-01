import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import { createQrRecord, owner } from "@/orpc-server/resource/qr/fixtures"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"
import { QrService } from "@/orpc-server/resource/qr/service"

function setup() {
  const repository = mock<QrRepository>()
  const service = new QrService({
    repository,
    clock: { now: () => new Date("2030-01-01T00:00:00.000Z") },
    ids: {
      generateId: () => "generated-id",
      generateSlug: () => "generated1a",
    },
  })
  repository.getOrganizationMemberRole.mockResolvedValue("owner")
  return { repository, service }
}

describe("QrService.archive", () => {
  it("archives an organization QR code", async () => {
    const { repository, service } = setup()
    const active = createQrRecord()
    const archived = createQrRecord({ deletedAt: new Date("2030-01-01T00:00:00.000Z") })
    repository.findById.mockResolvedValue(active)
    repository.archiveById.mockResolvedValue(archived)

    await expect(
      service.archive({ actor: owner, organizationId: "org-1", id: "qr-1" }),
    ).resolves.toMatchObject({
      deletedAt: "2030-01-01T00:00:00.000Z",
    })
    expect(repository.findById.mock.calls).toEqual([[{ id: "qr-1" }]])
    expect(repository.archiveById.mock.calls).toEqual([
      [
        {
          id: "qr-1",
          organizationId: "org-1",
          deletedAt: new Date("2030-01-01T00:00:00.000Z"),
          updatedAt: new Date("2030-01-01T00:00:00.000Z"),
        },
      ],
    ])
  })

  it("reports not found when the archive update affects no record", async () => {
    const { repository, service } = setup()
    repository.findById.mockResolvedValue(createQrRecord())
    repository.archiveById.mockResolvedValue(null)

    await expect(
      service.archive({ actor: owner, organizationId: "org-1", id: "qr-1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})
