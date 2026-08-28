import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { PlacesAdapter } from "@/orpc-server/resource/qr/places"
import { createQrRecord, owner } from "@/orpc-server/resource/qr/fixtures"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"
import { QrService } from "@/orpc-server/resource/qr/service"

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
  })
})
