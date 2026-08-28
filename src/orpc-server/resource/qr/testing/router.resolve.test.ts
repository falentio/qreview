import { call } from "@orpc/server"
import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { ApiContext } from "@/orpc-server/context"
import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import { createQrRouter } from "@/orpc-server/resource/qr/router"
import type { PlacesAdapter } from "@/orpc-server/resource/qr/places"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"
import { QrService } from "@/orpc-server/resource/qr/service"
import type { AuthSession, SessionRepository } from "@/orpc-server/resource/session/repository"
import { SessionService } from "@/orpc-server/resource/session/service"

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

describe("QrRouter.resolve", () => {
  it("maps Places outages to the service-unavailable ORPC error", async () => {
    const repository = mock<QrRepository>()
    repository.getOrganizationMemberRole.mockResolvedValue("owner")
    const places = mock<PlacesAdapter>()
    places.search.mockRejectedValue(
      new QrDomainError("PLACES_UNAVAILABLE", "Google Places is unavailable."),
    )
    const service = new QrService({
      repository,
      places,
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
      db: {} as ApiContext["db"],
      sessionService: new SessionService({ repository: sessionRepository }),
    } satisfies ApiContext

    await expect(
      call(
        router.resolve,
        {
          organizationId: "org-1",
          googleMapsUrl: "https://www.google.com/maps/search/?query=Example",
        },
        { context },
      ),
    ).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      data: { code: "PLACES_UNAVAILABLE" },
    })
  })
})
