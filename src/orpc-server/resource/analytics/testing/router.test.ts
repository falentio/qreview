import { call } from "@orpc/server"
import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { ApiContext } from "@/orpc-server/context"
import { testLogger } from "@/orpc-server/testing/logger"
import { createAnalyticsRouter } from "@/orpc-server/resource/analytics/router"
import type { AnalyticsService } from "@/orpc-server/resource/analytics/service"
import type { AuthSession, SessionRepository } from "@/orpc-server/resource/session/repository"
import { SessionService } from "@/orpc-server/resource/session/service"

function createContext({ role = "user", authenticated = true } = {}): ApiContext {
  const sessionRepository = mock<SessionRepository>()
  sessionRepository.getCurrentSession.mockResolvedValue(
    authenticated
      ? ({
          user: {
            id: role === "admin" ? "admin-1" : "owner-1",
            email: "owner@example.com",
            name: "Example Owner",
            role,
          },
          session: { expiresAt: new Date("2030-01-01T00:00:00.000Z") },
        } as AuthSession)
      : null,
  )
  return {
    request: new Request("http://localhost/rpc"),
    requestId: "test-request",
    logger: testLogger,
    db: {} as ApiContext["db"],
    auth: {} as ApiContext["auth"],
    sessionService: new SessionService({ repository: sessionRepository }),
  }
}

describe("AnalyticsRouter", () => {
  it("reads a QR hourly series for an authenticated caller", async () => {
    const service = mock<AnalyticsService>()
    service.getQrHourly.mockResolvedValue({
      items: [{ hour: "2030-01-01T00:00:00.000Z", redirectAttempts: 2 }],
    })
    const router = createAnalyticsRouter({ service })
    const input = {
      organizationId: "org-1",
      qrCodeId: "qr-1",
      from: "2030-01-01T00:00:00.000Z",
      to: "2030-01-01T01:00:00.000Z",
    }

    await expect(call(router.qr.hourly, input, { context: createContext() })).resolves.toEqual({
      items: [{ hour: "2030-01-01T00:00:00.000Z", redirectAttempts: 2 }],
    })
    expect(service.getQrHourly.mock.calls).toEqual([[{ actor: expect.anything(), ...input }]])
  })

  it("allows only global admins to run retention cleanup", async () => {
    const service = mock<AnalyticsService>()
    service.deleteExpired.mockResolvedValue({ deletedBuckets: 4 })
    const router = createAnalyticsRouter({ service })

    await expect(
      call(router.cleanup, {}, { context: createContext({ role: "user" }) }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(
      call(router.cleanup, {}, { context: createContext({ role: "admin" }) }),
    ).resolves.toEqual({ deletedBuckets: 4 })
    expect(service.deleteExpired.mock.calls).toHaveLength(1)
  })

  it("requires authentication for analytics reads", async () => {
    const service = mock<AnalyticsService>()
    const router = createAnalyticsRouter({ service })

    await expect(
      call(
        router.qr.hourly,
        {
          organizationId: "org-1",
          qrCodeId: "qr-1",
          from: "2030-01-01T00:00:00.000Z",
          to: "2030-01-01T01:00:00.000Z",
        },
        { context: createContext({ authenticated: false }) },
      ),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
    expect(service.getQrHourly.mock.calls).toHaveLength(0)
  })

  it("reads organization analytics and protects the fill mutation", async () => {
    const service = mock<AnalyticsService>()
    service.getOrganizationHourly.mockResolvedValue({
      items: [{ hour: "2030-01-01T00:00:00.000Z", redirectAttempts: 3 }],
    })
    service.fillQrHourly.mockResolvedValue({ slug: "abc123def4", bucketsFilled: 1 })
    const router = createAnalyticsRouter({ service })
    const range = {
      organizationId: "org-1",
      from: "2030-01-01T00:00:00.000Z",
      to: "2030-01-01T01:00:00.000Z",
    }

    await expect(
      call(router.organization.hourly, range, { context: createContext() }),
    ).resolves.toEqual({
      items: [{ hour: "2030-01-01T00:00:00.000Z", redirectAttempts: 3 }],
    })
    await expect(
      call(
        router.qr.fill,
        {
          slug: "abc123def4",
          from: range.from,
          to: range.to,
          redirectAttempts: 7,
        },
        { context: createContext({ role: "user" }) },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(
      call(
        router.qr.fill,
        {
          slug: "abc123def4",
          from: range.from,
          to: range.to,
          redirectAttempts: 7,
        },
        { context: createContext({ role: "admin" }) },
      ),
    ).resolves.toEqual({ slug: "abc123def4", bucketsFilled: 1 })
    expect(service.getOrganizationHourly.mock.calls).toHaveLength(1)
    expect(service.fillQrHourly.mock.calls).toHaveLength(1)
  })
})
