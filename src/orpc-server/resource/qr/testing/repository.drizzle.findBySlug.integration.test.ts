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

describe("DrizzleQrRepository.findBySlug against D1", () => {
  it("retrieves the QR record for its slug", async () => {
    await createOrganization({ id: "repo-test-org-1", userId: "repo-test-user-1" })
    const input = record({
      id: "repo-test-qr-1",
      slug: "repo123456",
      organizationId: "repo-test-org-1",
      target: {
        rawGoogleMapsUrl: "https://www.google.com/maps/search/?query=Example",
        googlePlaceId: "ChIJ123456789",
        canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ123456789",
      },
      claimable: false,
    })
    const created = await repository.create(input)

    await expect(repository.findBySlug({ slug: input.slug })).resolves.toEqual(created)
  })
})
