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
    ids: {
      generateId: () => "generated-id",
      generateSlug: () => "generated1a",
    },
  })
  repository.getOrganizationMemberRole.mockResolvedValue("owner")
  return { repository, service }
}

describe("QrService.get", () => {
  it("does not expose orphan metadata to an organization admin", async () => {
    const { repository, service } = setup()
    repository.findBySlug.mockResolvedValue(createQrRecord({ organizationId: null }))

    await expect(
      service.get({ actor: owner, organizationId: "org-1", slug: "abc123def4" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("uses an explicitly supplied empty ID rather than falling back to slug lookup", async () => {
    const { repository, service } = setup()
    repository.findById.mockResolvedValue(null)

    await expect(
      service.get({ actor: owner, organizationId: "org-1", id: "" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect(repository.findById.mock.calls).toEqual([[{ id: "" }]])
    expect(repository.findBySlug.mock.calls).toHaveLength(0)
  })
})
