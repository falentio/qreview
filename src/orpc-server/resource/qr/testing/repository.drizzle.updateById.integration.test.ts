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

describe("QrRepository.updateById against D1", () => {
  it("updates only the requested organization record", async () => {
    await createOrganization({ id: "repo-test-org-1", userId: "repo-test-user-1" })
    await createOrganization({ id: "repo-test-org-2", userId: "repo-test-user-2" })
    await repository.create(
      record({
        id: "repo-test-qr-update",
        slug: "repoupdate1",
        organizationId: "repo-test-org-1",
      }),
    )

    await expect(
      repository.updateById({
        id: "repo-test-qr-update",
        organizationId: "repo-test-org-2",
        alias: "Wrong organization",
        updatedAt: new Date("2030-01-02T00:00:00.000Z"),
      }),
    ).resolves.toBeNull()
    const updated = await repository.updateById({
      id: "repo-test-qr-update",
      organizationId: "repo-test-org-1",
      alias: "Updated location",
      target: {
        rawGoogleMapsUrl: "https://www.google.com/maps/search/?query=Updated",
        googlePlaceId: "ChIJ987654321",
        canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ987654321",
      },
      updatedAt: new Date("2030-01-02T00:00:00.000Z"),
    })

    expect(updated).toMatchObject({ alias: "Updated location", googlePlaceId: "ChIJ987654321" })
  })
})
