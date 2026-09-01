import { beforeEach, describe, expect, it } from "vite-plus/test"

import { createQrPublicResponse } from "@/orpc-server/resource/qr/public"
import { QrService } from "@/orpc-server/resource/qr/service"
import { AnalyticsService } from "@/orpc-server/resource/analytics/service"

import {
  analyticsRepository,
  clearTestData,
  record,
  repository as qrRepository,
} from "@/orpc-server/resource/qr/testing/repository.drizzle.fixtures"

beforeEach(async () => {
  await clearTestData()
})

describe("QR public redirect analytics against D1", () => {
  it("records the redirect event through the composed analytics listener", async () => {
    await qrRepository.create(
      record({
        id: "repo-test-qr-redirect",
        slug: "reporedir1",
        organizationId: null,
        target: {
          rawGoogleMapsUrl: "https://www.google.com/maps/search/?query=Example",
          googlePlaceId: "ChIJ123456789",
          canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ123456789",
        },
      }),
    )
    const qrService = new QrService({
      repository: qrRepository,
      ids: {
        generateId: () => "generated-id",
        generateSlug: () => "generated1a",
      },
    })
    const analyticsService = new AnalyticsService({
      repository: analyticsRepository,
      qrRepository,
    })
    const publicResponse = createQrPublicResponse({
      service: qrService,
      onQrRedirected: (event) => analyticsService.recordRedirect(event),
    })
    const pending: Promise<unknown>[] = []

    const response = await publicResponse({
      slug: "reporedir1",
      waitUntil: (promise) => pending.push(promise),
    })
    await Promise.all(pending)

    expect(response.status).toBe(307)
    await expect(
      analyticsRepository.listHourly({
        qrCodeId: "repo-test-qr-redirect",
        from: new Date("2000-01-01T00:00:00.000Z"),
        to: new Date("2100-01-01T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject([{ qrCodeId: "repo-test-qr-redirect", redirectAttempts: 1 }])
  })

  it("does not record analytics for an expired QR code", async () => {
    await qrRepository.create(
      record({
        id: "repo-test-qr-expired",
        slug: "repoexpire1",
        organizationId: null,
        expiresAt: new Date("2030-01-02T00:00:00.000Z"),
        target: {
          rawGoogleMapsUrl: "https://www.google.com/maps/search/?query=Example",
          googlePlaceId: "ChIJ123456789",
          canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ123456789",
        },
      }),
    )
    const qrService = new QrService({
      repository: qrRepository,
      clock: { now: () => new Date("2030-01-02T00:00:00.000Z") },
      ids: {
        generateId: () => "generated-id",
        generateSlug: () => "generated1a",
      },
    })
    const analyticsService = new AnalyticsService({
      repository: analyticsRepository,
      qrRepository,
    })
    const publicResponse = createQrPublicResponse({
      service: qrService,
      onQrRedirected: (event) => analyticsService.recordRedirect(event),
    })
    const pending: Promise<unknown>[] = []

    const response = await publicResponse({
      slug: "repoexpire1",
      waitUntil: (promise) => pending.push(promise),
    })
    await Promise.all(pending)

    expect(response.status).toBe(410)
    await expect(
      analyticsRepository.listHourly({
        qrCodeId: "repo-test-qr-expired",
        from: new Date("2000-01-01T00:00:00.000Z"),
        to: new Date("2100-01-01T00:00:00.000Z"),
      }),
    ).resolves.toEqual([])
  })
})
