import { beforeEach, describe, expect, it } from "vite-plus/test"

import { clearTestData, record, repository } from "./repository.drizzle.fixtures"

beforeEach(async () => {
  await clearTestData()
})

describe("DrizzleQrRepository.updateMapBySlug against D1", () => {
  it("updates an orphan map target without assigning an organization", async () => {
    await repository.create(
      record({
        id: "repo-test-qr-map",
        slug: "repomap001",
        organizationId: null,
      }),
    )

    const updated = await repository.updateMapBySlug({
      slug: "repomap001",
      target: {
        rawGoogleMapsUrl: "https://www.google.com/maps/search/?query=Updated",
        googlePlaceId: "ChIJ987654321",
        canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ987654321",
      },
      updatedAt: new Date("2030-01-02T00:00:00.000Z"),
    })

    expect(updated).toMatchObject({
      slug: "repomap001",
      organizationId: null,
      rawGoogleMapsUrl: "https://www.google.com/maps/search/?query=Updated",
      googlePlaceId: "ChIJ987654321",
      canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ987654321",
    })
  })

  it("does not update an archived QR code", async () => {
    await repository.create(
      record({
        id: "repo-test-qr-archived-map",
        slug: "repoarchmp1",
        organizationId: null,
        deletedAt: new Date("2030-01-01T00:00:00.000Z"),
      }),
    )

    await expect(
      repository.updateMapBySlug({
        slug: "repoarchmp1",
        target: {
          rawGoogleMapsUrl: "https://www.google.com/maps/search/?query=Updated",
          googlePlaceId: "ChIJ987654321",
          canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ987654321",
        },
        updatedAt: new Date("2030-01-02T00:00:00.000Z"),
      }),
    ).resolves.toBeNull()
  })
})
