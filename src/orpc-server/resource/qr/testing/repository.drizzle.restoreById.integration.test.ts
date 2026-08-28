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

describe("DrizzleQrRepository.restoreById against D1", () => {
  it("restores the requested organization record", async () => {
    await createOrganization({ id: "repo-test-org-1", userId: "repo-test-user-1" })
    await repository.create(
      record({
        id: "repo-test-qr-restore",
        slug: "reporestore",
        organizationId: "repo-test-org-1",
        deletedAt: new Date("2030-01-03T00:00:00.000Z"),
      }),
    )

    const restored = await repository.restoreById({
      id: "repo-test-qr-restore",
      organizationId: "repo-test-org-1",
      updatedAt: new Date("2030-01-04T00:00:00.000Z"),
    })

    expect(restored?.deletedAt).toBeNull()
  })
})
