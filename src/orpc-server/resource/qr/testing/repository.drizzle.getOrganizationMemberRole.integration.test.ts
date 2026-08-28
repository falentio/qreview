import { beforeEach, describe, expect, it } from "vite-plus/test"

import { clearTestData, createOrganization, repository } from "./repository.drizzle.fixtures"

beforeEach(async () => {
  await clearTestData()
})

describe("DrizzleQrRepository.getOrganizationMemberRole against D1", () => {
  it("returns the member role and null for a non-member", async () => {
    await createOrganization({ id: "repo-test-org-1", userId: "repo-test-user-1" })
    await createOrganization({ id: "repo-test-org-2", userId: "repo-test-user-2" })

    await expect(
      repository.getOrganizationMemberRole({
        organizationId: "repo-test-org-1",
        userId: "repo-test-user-1",
      }),
    ).resolves.toBe("owner")
    await expect(
      repository.getOrganizationMemberRole({
        organizationId: "repo-test-org-2",
        userId: "repo-test-user-1",
      }),
    ).resolves.toBeNull()
  })
})
