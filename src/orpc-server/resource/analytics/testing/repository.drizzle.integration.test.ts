import { beforeEach, describe, expect, it } from "vite-plus/test"

import {
  analyticsRepository,
  clearTestData,
  createOrganization,
  record,
  repository as qrRepository,
} from "@/orpc-server/resource/qr/testing/repository.drizzle.fixtures"

beforeEach(async () => {
  await clearTestData()
})

describe("DrizzleQrAnalyticsRepository against D1", () => {
  it("atomically accumulates redirect attempts per QR and UTC hour", async () => {
    await createOrganization({ id: "repo-test-org-1", userId: "repo-test-user-1" })
    await qrRepository.create(
      record({
        id: "repo-test-qr-analytics",
        slug: "repoanaly1",
        organizationId: "repo-test-org-1",
      }),
    )

    const firstHour = new Date("2030-01-01T10:00:00.000Z")
    await analyticsRepository.incrementRedirectAttempts({
      qrCodeId: "repo-test-qr-analytics",
      bucketStart: firstHour,
    })
    await analyticsRepository.incrementRedirectAttempts({
      qrCodeId: "repo-test-qr-analytics",
      bucketStart: firstHour,
    })
    await analyticsRepository.incrementRedirectAttempts({
      qrCodeId: "repo-test-qr-analytics",
      bucketStart: new Date("2030-01-01T11:00:00.000Z"),
    })

    await expect(
      analyticsRepository.listHourly({
        qrCodeId: "repo-test-qr-analytics",
        from: firstHour,
        to: new Date("2030-01-01T12:00:00.000Z"),
      }),
    ).resolves.toMatchObject([
      { qrCodeId: "repo-test-qr-analytics", bucketStart: firstHour, redirectAttempts: 2 },
      {
        qrCodeId: "repo-test-qr-analytics",
        bucketStart: new Date("2030-01-01T11:00:00.000Z"),
        redirectAttempts: 1,
      },
    ])
  })

  it("deletes only buckets older than the supplied cutoff", async () => {
    await createOrganization({ id: "repo-test-org-1", userId: "repo-test-user-1" })
    await qrRepository.create(
      record({
        id: "repo-test-qr-cleanup",
        slug: "repoclean1",
        organizationId: "repo-test-org-1",
      }),
    )
    await analyticsRepository.incrementRedirectAttempts({
      qrCodeId: "repo-test-qr-cleanup",
      bucketStart: new Date("2030-01-01T00:00:00.000Z"),
    })
    await analyticsRepository.incrementRedirectAttempts({
      qrCodeId: "repo-test-qr-cleanup",
      bucketStart: new Date("2030-01-02T00:00:00.000Z"),
    })

    await expect(
      analyticsRepository.deleteOlderThan({ cutoff: new Date("2030-01-01T12:00:00.000Z") }),
    ).resolves.toBe(1)
    await expect(
      analyticsRepository.listHourly({
        qrCodeId: "repo-test-qr-cleanup",
        from: new Date("2030-01-01T00:00:00.000Z"),
        to: new Date("2030-01-03T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject([
      {
        qrCodeId: "repo-test-qr-cleanup",
        bucketStart: new Date("2030-01-02T00:00:00.000Z"),
        redirectAttempts: 1,
      },
    ])
  })

  it("fills exact hourly values and aggregates all QR codes in an organization", async () => {
    await createOrganization({ id: "repo-test-org-1", userId: "repo-test-user-1" })
    await qrRepository.create(
      record({
        id: "repo-test-qr-analytics-one",
        slug: "repoanaly2",
        organizationId: "repo-test-org-1",
      }),
    )
    await qrRepository.create(
      record({
        id: "repo-test-qr-analytics-two",
        slug: "repoanaly3",
        organizationId: "repo-test-org-1",
      }),
    )

    await expect(
      analyticsRepository.fillHourly({
        qrCodeId: "repo-test-qr-analytics-one",
        from: new Date("2030-01-01T10:00:00.000Z"),
        to: new Date("2030-01-01T12:00:00.000Z"),
        redirectAttempts: 4,
      }),
    ).resolves.toBe(2)
    await expect(
      analyticsRepository.fillHourly({
        qrCodeId: "repo-test-qr-analytics-two",
        from: new Date("2030-01-01T10:00:00.000Z"),
        to: new Date("2030-01-01T11:00:00.000Z"),
        redirectAttempts: 3,
      }),
    ).resolves.toBe(1)

    await expect(
      analyticsRepository.listOrganizationHourly({
        organizationId: "repo-test-org-1",
        from: new Date("2030-01-01T10:00:00.000Z"),
        to: new Date("2030-01-01T12:00:00.000Z"),
      }),
    ).resolves.toMatchObject([
      { bucketStart: new Date("2030-01-01T10:00:00.000Z"), redirectAttempts: 7 },
      { bucketStart: new Date("2030-01-01T11:00:00.000Z"), redirectAttempts: 4 },
    ])
  })
})
