import { beforeEach, describe, expect, it } from "vite-plus/test"

import {
  clearTestData,
  createOrganization,
  record,
  repository,
} from "./repository.drizzle.fixtures"

beforeEach(async () => {
  await clearTestData()
})

describe("DrizzleQrRepository.listForOrganization against D1", () => {
  it("returns only the requested organization and orders records by creation time", async () => {
    await createOrganization({ id: "repo-test-org-1", userId: "repo-test-user-1" })
    await createOrganization({ id: "repo-test-org-2", userId: "repo-test-user-2" })
    await repository.create(
      record({
        id: "repo-test-qr-early",
        slug: "repoearly1",
        organizationId: "repo-test-org-1",
        createdAt: new Date("2030-01-01T00:00:00.000Z"),
      }),
    )
    await repository.create(
      record({
        id: "repo-test-qr-late",
        slug: "repo-late1",
        organizationId: "repo-test-org-1",
        createdAt: new Date("2030-01-03T00:00:00.000Z"),
      }),
    )
    await repository.create(
      record({
        id: "repo-test-qr-other",
        slug: "repoother1",
        organizationId: "repo-test-org-2",
      }),
    )

    const records = await repository.listForOrganization({
      organizationId: "repo-test-org-1",
      includeArchived: false,
    })

    expect(records.map(({ id }) => id)).toEqual(["repo-test-qr-early", "repo-test-qr-late"])
  })

  it("excludes archived records by default and includes them on request", async () => {
    await createOrganization({ id: "repo-test-org-1", userId: "repo-test-user-1" })
    await repository.create(
      record({
        id: "repo-test-qr-archived",
        slug: "repoarchiv",
        organizationId: "repo-test-org-1",
        deletedAt: new Date("2030-01-02T00:00:00.000Z"),
      }),
    )

    await expect(
      repository.listForOrganization({
        organizationId: "repo-test-org-1",
        includeArchived: false,
      }),
    ).resolves.toEqual([])
    await expect(
      repository.listForOrganization({
        organizationId: "repo-test-org-1",
        includeArchived: true,
      }),
    ).resolves.toHaveLength(1)
  })
})
