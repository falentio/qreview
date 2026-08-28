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

describe("QrRepository.archiveById against D1", () => {
  it("archives the requested organization record", async () => {
    await createOrganization({ id: "repo-test-org-1", userId: "repo-test-user-1" })
    await repository.create(
      record({
        id: "repo-test-qr-archive",
        slug: "repoarchive",
        organizationId: "repo-test-org-1",
      }),
    )

    const archived = await repository.archiveById({
      id: "repo-test-qr-archive",
      organizationId: "repo-test-org-1",
      deletedAt: new Date("2030-01-03T00:00:00.000Z"),
      updatedAt: new Date("2030-01-03T00:00:00.000Z"),
    })

    expect(archived?.deletedAt).toEqual(new Date("2030-01-03T00:00:00.000Z"))
  })
})
