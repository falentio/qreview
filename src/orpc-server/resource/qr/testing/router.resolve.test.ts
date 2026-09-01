import { call } from "@orpc/server"
import { describe, expect, it, vi } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { AppLogger } from "@/lib/logging"
import type { ApiContext } from "@/orpc-server/context"
import { googleMapsUrl, googlePlaceId } from "@/orpc-server/resource/qr/fixtures"
import { createQrRouter } from "@/orpc-server/resource/qr/router"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"
import { QrService } from "@/orpc-server/resource/qr/service"
import type { AuthSession, SessionRepository } from "@/orpc-server/resource/session/repository"
import { SessionService } from "@/orpc-server/resource/session/service"
import { testLogger } from "@/orpc-server/testing/logger"

const currentSession = {
  user: {
    id: "owner-1",
    email: "owner@example.com",
    name: "Example Owner",
    role: "user",
  },
  session: {
    expiresAt: new Date("2030-01-01T00:00:00.000Z"),
  },
} as AuthSession

function setup({ fetcher }: { fetcher?: typeof fetch } = {}) {
  const repository = mock<QrRepository>()
  repository.getOrganizationMemberRole.mockResolvedValue("owner")
  const service = new QrService({
    repository,
    fetcher,
    ids: {
      generateId: () => "generated-id",
      generateSlug: () => "generated1a",
    },
  })
  const router = createQrRouter({ service })
  const sessionRepository = mock<SessionRepository>()
  sessionRepository.getCurrentSession.mockResolvedValue(currentSession)
  const context = {
    request: new Request("http://localhost/rpc"),
    requestId: "test-request",
    logger: { ...testLogger, error: vi.fn() } as AppLogger,
    db: {} as ApiContext["db"],
    auth: {} as ApiContext["auth"],
    sessionService: new SessionService({ repository: sessionRepository }),
  } satisfies ApiContext

  return { context, repository, router }
}

describe("QrRouter.resolve", () => {
  it("resolves a specific Maps URL without a Places provider", async () => {
    const { context, router } = setup()

    await expect(
      call(router.resolve, { organizationId: "org-1", googleMapsUrl }, { context }),
    ).resolves.toEqual({
      candidates: [{ placeId: googlePlaceId, name: "Example", address: null }],
    })
  })

  it("maps an unresolved query URL to a bad-request ORPC error", async () => {
    const { context, router } = setup()

    await expect(
      call(
        router.resolve,
        {
          organizationId: "org-1",
          googleMapsUrl: "https://www.google.com/maps/search/?query=Unknown",
        },
        { context },
      ),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { code: "PLACE_RESOLUTION_FAILED" },
    })
  })

  it("maps short-link failures to a bad-request ORPC error", async () => {
    const logger = { warn: vi.fn() } as Pick<AppLogger, "warn">
    const fetcher = async () => {
      throw new Error("network down")
    }
    const repository = mock<QrRepository>()
    repository.getOrganizationMemberRole.mockResolvedValue("owner")
    const service = new QrService({
      repository,
      fetcher,
      logger,
      ids: { generateId: () => "generated-id", generateSlug: () => "generated1a" },
    })
    const router = createQrRouter({ service })
    const sessionRepository = mock<SessionRepository>()
    sessionRepository.getCurrentSession.mockResolvedValue(currentSession)
    const context = {
      request: new Request("http://localhost/rpc"),
      requestId: "test-request",
      logger: { ...testLogger, warn: logger.warn },
      db: {} as ApiContext["db"],
      auth: {} as ApiContext["auth"],
      sessionService: new SessionService({ repository: sessionRepository }),
    } satisfies ApiContext

    await expect(
      call(
        router.resolve,
        {
          organizationId: "org-1",
          googleMapsUrl: "https://maps.app.goo.gl/example",
        },
        { context },
      ),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { code: "PLACE_RESOLUTION_FAILED" },
    })
  })

  it("still maps domain failures raised by the resolver", async () => {
    const { context, router } = setup()

    await expect(
      call(
        router.resolve,
        { organizationId: "org-1", googleMapsUrl: "https://example.com/maps" },
        { context },
      ),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { code: "INVALID_GOOGLE_MAPS_URL" },
    })
  })
})
