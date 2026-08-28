import { beforeEach, describe, expect, it } from "vite-plus/test"

import {
  clearTestData,
  createOrganization,
  record,
  repository,
  timestamp,
} from "./repository.drizzle.fixtures"

beforeEach(async () => {
  await clearTestData()
})

describe("DrizzleQrRepository.claimBySlug against D1", () => {
  it("claims an eligible orphan once and rejects subsequent claims", async () => {
    await createOrganization({ id: "repo-test-org-1", userId: "repo-test-user-1" })
    await createOrganization({ id: "repo-test-org-2", userId: "repo-test-user-2" })
    await repository.create(
      record({
        id: "repo-test-qr-orphan",
        slug: "reporphan1",
        organizationId: null,
        claimable: true,
      }),
    )

    const claimed = await repository.claimBySlug({
      slug: "reporphan1",
      organizationId: "repo-test-org-1",
      claimedById: "repo-test-user-1",
      claimedAt: timestamp,
      updatedAt: timestamp,
    })
    const secondClaim = await repository.claimBySlug({
      slug: "reporphan1",
      organizationId: "repo-test-org-2",
      claimedById: "repo-test-user-2",
      claimedAt: timestamp,
      updatedAt: timestamp,
    })

    expect(claimed).toMatchObject({
      organizationId: "repo-test-org-1",
      claimedById: "repo-test-user-1",
      claimable: false,
    })
    expect(secondClaim).toBeNull()
  })
})
