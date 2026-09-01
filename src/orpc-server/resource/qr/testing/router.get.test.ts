import { call } from "@orpc/server"
import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { ApiContext } from "@/orpc-server/context"
import { createQrRouter } from "@/orpc-server/resource/qr/router"
import type { PlacesAdapter } from "@/orpc-server/resource/qr/places"
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

function createOrganizationAuth(): ApiContext["auth"] {
  return {
    api: {
      getActiveMemberRole: async () => ({ role: "owner" }),
    },
  } as unknown as ApiContext["auth"]
}

describe("QrRouter.get", () => {
  it("rejects empty IDs and malformed slugs at the get contract boundary", async () => {
    const repository = mock<QrRepository>()
    repository.getOrganizationMemberRole.mockResolvedValue("owner")
    const places = mock<PlacesAdapter>()
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
      requestId: "test-request",
      logger: testLogger,
      db: {} as ApiContext["db"],
      auth: createOrganizationAuth(),
      sessionService: new SessionService({ repository: sessionRepository }),
    } satisfies ApiContext

    for (const input of [
      { organizationId: "org-1", id: "" },
      { organizationId: "org-1", slug: "bad-slug" },
    ]) {
      await expect(call(router.get, input, { context })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      })
    }
    expect(repository.findById.mock.calls).toHaveLength(0)
    expect(repository.findBySlug.mock.calls).toHaveLength(0)
  })
})
