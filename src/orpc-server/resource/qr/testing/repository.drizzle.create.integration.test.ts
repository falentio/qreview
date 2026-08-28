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

describe("QrRepository.create against D1", () => {
  it("creates a complete QR record", async () => {
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

    expect(created).toMatchObject({
      id: "repo-test-qr-1",
      slug: "repo123456",
      organizationId: "repo-test-org-1",
      rawGoogleMapsUrl: "https://www.google.com/maps/search/?query=Example",
      googlePlaceId: "ChIJ123456789",
      canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ123456789",
      claimable: false,
    })
  })

  it("translates duplicate slugs into a domain conflict", async () => {
    await createOrganization({ id: "repo-test-org-1", userId: "repo-test-user-1" })
    await repository.create(
      record({
        id: "repo-test-qr-first",
        slug: "repodupes1",
        organizationId: "repo-test-org-1",
        claimable: false,
      }),
    )

    await expect(
      repository.create(
        record({
          id: "repo-test-qr-second",
          slug: "repodupes1",
          organizationId: "repo-test-org-1",
          claimable: false,
        }),
      ),
    ).rejects.toMatchObject({
      code: "SLUG_CONFLICT",
      httpCode: "CONFLICT",
    })
  })
})
