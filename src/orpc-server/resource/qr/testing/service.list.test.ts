import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import { createQrRecord, owner } from "@/orpc-server/resource/qr/fixtures"
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
  return { repository, service }
}

describe("QrService.list", () => {
  it("accepts owner and admin when Better Auth stores multiple roles", async () => {
    const { repository, service } = setup()
    repository.listForOrganization.mockResolvedValue([createQrRecord({ alias: "Organization QR" })])

    for (const role of ["member,owner", "member, admin"]) {
      repository.getOrganizationMemberRole.mockResolvedValue(role)

      await expect(service.list({ actor: owner, organizationId: "org-1" })).resolves.toMatchObject({
        items: [{ alias: "Organization QR", id: "qr-1", organizationId: "org-1" }],
      })
    }
    expect(repository.listForOrganization.mock.calls).toEqual([
      [{ organizationId: "org-1", includeArchived: false }],
      [{ organizationId: "org-1", includeArchived: false }],
    ])
  })

  it("passes the includeArchived option to the repository", async () => {
    const { repository, service } = setup()
    repository.getOrganizationMemberRole.mockResolvedValue("admin")
    repository.listForOrganization.mockResolvedValue([
      createQrRecord({ deletedAt: new Date("2030-01-02T00:00:00.000Z") }),
    ])

    await expect(
      service.list({ actor: owner, organizationId: "org-1", includeArchived: true }),
    ).resolves.toMatchObject({
      items: [{ deletedAt: "2030-01-02T00:00:00.000Z" }],
    })
    expect(repository.listForOrganization.mock.calls).toEqual([
      [{ organizationId: "org-1", includeArchived: true }],
    ])
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
