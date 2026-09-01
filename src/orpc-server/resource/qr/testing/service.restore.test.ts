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

describe("QrService.restore", () => {
  it("restores an organization QR code", async () => {
    const { repository, service } = setup()
    const archived = createQrRecord({ deletedAt: new Date("2030-01-02T00:00:00.000Z") })
    const restored = createQrRecord()
    repository.findById.mockResolvedValue(archived)
    repository.restoreById.mockResolvedValue(restored)

    await expect(
      service.restore({ actor: owner, organizationId: "org-1", id: "qr-1" }),
    ).resolves.toMatchObject({
      deletedAt: null,
    })
    expect(repository.findById.mock.calls).toEqual([[{ id: "qr-1" }]])
    expect(repository.restoreById.mock.calls).toEqual([
      [
        {
          id: "qr-1",
          organizationId: "org-1",
          updatedAt: new Date("2030-01-01T00:00:00.000Z"),
        },
      ],
    ])
  })

  it("reports not found when the restore update affects no record", async () => {
    const { repository, service } = setup()
    repository.findById.mockResolvedValue(createQrRecord({ deletedAt: new Date() }))
    repository.restoreById.mockResolvedValue(null)

    await expect(
      service.restore({ actor: owner, organizationId: "org-1", id: "qr-1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})
