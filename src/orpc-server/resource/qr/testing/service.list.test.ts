import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { PlacesAdapter } from "@/orpc-server/resource/qr/places"
import { owner } from "@/orpc-server/resource/qr/fixtures"
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
  return { repository, service }
}

describe("QrService.list", () => {
  it("accepts owner and admin when Better Auth stores multiple roles", async () => {
    const { repository, service } = setup()
    repository.listForOrganization.mockResolvedValue([])

    for (const role of ["member,owner", "member, admin"]) {
      repository.getOrganizationMemberRole.mockResolvedValue(role)

      await expect(service.list({ actor: owner, organizationId: "org-1" })).resolves.toEqual({
        items: [],
      })
    }
  })

  it("does not let organization members manage QR codes", async () => {
    const { repository, service } = setup()
    repository.getOrganizationMemberRole.mockResolvedValue("member")

    await expect(service.list({ actor: owner, organizationId: "org-1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    })
    expect(repository.listForOrganization.mock.calls).toHaveLength(0)
  })
})
