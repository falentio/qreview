import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { QrRedirectedEvent } from "@/orpc-server/events"
import type {
  QrAnalyticsHourlyRecord,
  QrAnalyticsRepository,
} from "@/orpc-server/resource/analytics/repository"
import { AnalyticsService } from "@/orpc-server/resource/analytics/service"
import { createQrRecord, globalAdmin, owner } from "@/orpc-server/resource/qr/fixtures"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"

const now = new Date("2030-01-01T13:30:00.000Z")

function setup() {
  const repository = mock<QrAnalyticsRepository>()
  const qrRepository = mock<QrRepository>()
  qrRepository.getOrganizationMemberRole.mockResolvedValue("owner")
  qrRepository.findById.mockResolvedValue(createQrRecord())
  qrRepository.findBySlug.mockResolvedValue(createQrRecord())
  const service = new AnalyticsService({
    repository,
    qrRepository,
    clock: { now: () => now },
  })
  return { qrRepository, repository, service }
}

function hourlyRecord(bucketStart: string, redirectAttempts: number): QrAnalyticsHourlyRecord {
  return {
    qrCodeId: "qr-1",
    bucketStart: new Date(bucketStart),
    redirectAttempts,
  }
}

describe("AnalyticsService.recordRedirect", () => {
  it("increments the UTC hour containing the redirect event", async () => {
    const { repository, service } = setup()
    const event: QrRedirectedEvent = {
      type: "qr.redirected",
      qrCodeId: "qr-1",
      occurredAt: new Date("2030-01-01T12:45:00.000Z"),
    }

    await service.recordRedirect(event)

    expect(repository.incrementRedirectAttempts.mock.calls).toEqual([
      [{ qrCodeId: "qr-1", bucketStart: new Date("2030-01-01T12:00:00.000Z") }],
    ])
  })
})

describe("AnalyticsService.getQrHourly", () => {
  it("returns a complete zero-filled series for an organization QR code", async () => {
    const { repository, service } = setup()
    repository.listHourly.mockResolvedValue([
      hourlyRecord("2030-01-01T10:00:00.000Z", 3),
      hourlyRecord("2030-01-01T12:00:00.000Z", 1),
    ])

    await expect(
      service.getQrHourly({
        actor: owner,
        organizationId: "org-1",
        qrCodeId: "qr-1",
        from: "2030-01-01T10:00:00.000Z",
        to: "2030-01-01T13:00:00.000Z",
      }),
    ).resolves.toEqual({
      items: [
        { hour: "2030-01-01T10:00:00.000Z", redirectAttempts: 3 },
        { hour: "2030-01-01T11:00:00.000Z", redirectAttempts: 0 },
        { hour: "2030-01-01T12:00:00.000Z", redirectAttempts: 1 },
      ],
    })
    expect(repository.listHourly.mock.calls).toEqual([
      [
        {
          qrCodeId: "qr-1",
          from: new Date("2030-01-01T10:00:00.000Z"),
          to: new Date("2030-01-01T13:00:00.000Z"),
        },
      ],
    ])
  })

  it("allows global admins to read orphan QR history", async () => {
    const { qrRepository, repository, service } = setup()
    qrRepository.findById.mockResolvedValue(createQrRecord({ organizationId: null }))
    repository.listHourly.mockResolvedValue([])

    await expect(
      service.getQrHourly({
        actor: globalAdmin,
        organizationId: null,
        qrCodeId: "qr-1",
        from: "2030-01-01T10:00:00.000Z",
        to: "2030-01-01T11:00:00.000Z",
      }),
    ).resolves.toEqual({
      items: [{ hour: "2030-01-01T10:00:00.000Z", redirectAttempts: 0 }],
    })
    expect(qrRepository.getOrganizationMemberRole.mock.calls).toHaveLength(0)
  })

  it("does not expose a QR code to an organization that does not own it", async () => {
    const { qrRepository, repository, service } = setup()
    qrRepository.findById.mockResolvedValue(createQrRecord({ organizationId: "org-2" }))

    await expect(
      service.getQrHourly({
        actor: owner,
        organizationId: "org-1",
        qrCodeId: "qr-1",
        from: "2030-01-01T10:00:00.000Z",
        to: "2030-01-01T11:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect(repository.listHourly.mock.calls).toHaveLength(0)
  })

  it("rejects analytics reads for organization members without admin access", async () => {
    const { qrRepository, repository, service } = setup()
    qrRepository.getOrganizationMemberRole.mockResolvedValue("member")

    await expect(
      service.getQrHourly({
        actor: owner,
        organizationId: "org-1",
        qrCodeId: "qr-1",
        from: "2030-01-01T10:00:00.000Z",
        to: "2030-01-01T11:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(qrRepository.findBySlug.mock.calls).toHaveLength(0)
    expect(repository.listHourly.mock.calls).toHaveLength(0)
  })

  it("rejects ranges outside the rolling 60-day window", async () => {
    const { repository, service } = setup()

    await expect(
      service.getQrHourly({
        actor: owner,
        organizationId: "org-1",
        qrCodeId: "qr-1",
        from: "2029-11-02T12:29:59.000Z",
        to: "2029-11-02T13:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" })
    expect(repository.listHourly.mock.calls).toHaveLength(0)
  })

  it("rejects ranges that are not aligned to UTC hour boundaries", async () => {
    const { repository, service } = setup()

    await expect(
      service.getQrHourly({
        actor: owner,
        organizationId: "org-1",
        qrCodeId: "qr-1",
        from: "2030-01-01T10:30:00.000Z",
        to: "2030-01-01T11:30:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" })
    expect(repository.listHourly.mock.calls).toHaveLength(0)
  })

  it("rejects UTC timestamps with invalid calendar dates", async () => {
    const { repository, service } = setup()

    await expect(
      service.getQrHourly({
        actor: owner,
        organizationId: "org-1",
        qrCodeId: "qr-1",
        from: "2029-11-31T00:00:00.000Z",
        to: "2029-12-01T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" })
    expect(repository.listHourly.mock.calls).toHaveLength(0)
  })
})

describe("AnalyticsService.getOrganizationHourly", () => {
  it("returns a zero-filled series aggregated across an organization", async () => {
    const { repository, service } = setup()
    repository.listOrganizationHourly.mockResolvedValue([
      { bucketStart: new Date("2030-01-01T10:00:00.000Z"), redirectAttempts: 5 },
      { bucketStart: new Date("2030-01-01T12:00:00.000Z"), redirectAttempts: 2 },
    ])

    await expect(
      service.getOrganizationHourly({
        actor: owner,
        organizationId: "org-1",
        from: "2030-01-01T10:00:00.000Z",
        to: "2030-01-01T13:00:00.000Z",
      }),
    ).resolves.toEqual({
      items: [
        { hour: "2030-01-01T10:00:00.000Z", redirectAttempts: 5 },
        { hour: "2030-01-01T11:00:00.000Z", redirectAttempts: 0 },
        { hour: "2030-01-01T12:00:00.000Z", redirectAttempts: 2 },
      ],
    })
    expect(repository.listOrganizationHourly.mock.calls).toEqual([
      [
        {
          organizationId: "org-1",
          from: new Date("2030-01-01T10:00:00.000Z"),
          to: new Date("2030-01-01T13:00:00.000Z"),
        },
      ],
    ])
  })

  it("rejects organization analytics for a non-admin member", async () => {
    const { qrRepository, repository, service } = setup()
    qrRepository.getOrganizationMemberRole.mockResolvedValue("member")

    await expect(
      service.getOrganizationHourly({
        actor: owner,
        organizationId: "org-1",
        from: "2030-01-01T10:00:00.000Z",
        to: "2030-01-01T11:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(repository.listOrganizationHourly.mock.calls).toHaveLength(0)
  })
})

describe("AnalyticsService.fillQrHourly", () => {
  it("fills a bounded range of hourly buckets for a global admin", async () => {
    const { qrRepository, repository, service } = setup()
    repository.fillHourly.mockResolvedValue(48)

    await expect(
      service.fillQrHourly({
        actor: globalAdmin,
        slug: "abc123def4",
        from: "2029-12-30T00:00:00.000Z",
        to: "2030-01-01T00:00:00.000Z",
        redirectAttempts: 12,
      }),
    ).resolves.toEqual({ slug: "abc123def4", bucketsFilled: 48 })
    expect(qrRepository.findBySlug.mock.calls).toEqual([[{ slug: "abc123def4" }]])
    expect(repository.fillHourly.mock.calls).toEqual([
      [
        {
          qrCodeId: "qr-1",
          from: new Date("2029-12-30T00:00:00.000Z"),
          to: new Date("2030-01-01T00:00:00.000Z"),
          redirectAttempts: 12,
        },
      ],
    ])
  })

  it("rejects fill requests from non-global admins", async () => {
    const { qrRepository, repository, service } = setup()

    await expect(
      service.fillQrHourly({
        actor: owner,
        slug: "abc123def4",
        from: "2030-01-01T00:00:00.000Z",
        to: "2030-01-01T01:00:00.000Z",
        redirectAttempts: 1,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(qrRepository.findById.mock.calls).toHaveLength(0)
    expect(repository.fillHourly.mock.calls).toHaveLength(0)
  })

  it("rejects fill ranges longer than 30 days", async () => {
    const { repository, service } = setup()

    await expect(
      service.fillQrHourly({
        actor: globalAdmin,
        slug: "abc123def4",
        from: "2029-12-01T00:00:00.000Z",
        to: "2030-01-01T00:00:00.000Z",
        redirectAttempts: 1,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" })
    expect(repository.fillHourly.mock.calls).toHaveLength(0)
  })
})

describe("AnalyticsService.deleteExpired", () => {
  it("deletes all buckets older than 60 days for a global admin", async () => {
    const { repository, service } = setup()
    repository.deleteOlderThan.mockResolvedValue(4)

    await expect(service.deleteExpired({ actor: globalAdmin })).resolves.toEqual({
      deletedBuckets: 4,
    })
    expect(repository.deleteOlderThan.mock.calls).toEqual([
      [{ cutoff: new Date("2029-11-02T13:30:00.000Z") }],
    ])
  })

  it("rejects cleanup for non-global admins", async () => {
    const { repository, service } = setup()

    await expect(service.deleteExpired({ actor: owner })).rejects.toMatchObject({
      code: "FORBIDDEN",
    })
    expect(repository.deleteOlderThan.mock.calls).toHaveLength(0)
  })
})
