import { call } from "@orpc/server"
import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { ApiContext } from "@/orpc-server/context"
import { createSessionRouter } from "@/orpc-server/resource/session/router"
import type { AuthSession, SessionRepository } from "@/orpc-server/resource/session/repository"
import { SessionService } from "@/orpc-server/resource/session/service"

const currentSession = {
  user: {
    id: "user-1",
    email: "user@example.com",
    name: "Example User",
  },
  session: {
    expiresAt: new Date("2030-01-01T00:00:00.000Z"),
  },
} as AuthSession

function createContext(session: AuthSession | null): ApiContext {
  const repository = mock<SessionRepository>()
  repository.getCurrentSession.mockResolvedValue(session)

  return {
    auth: {} as ApiContext["auth"],
    request: new Request("http://localhost/rpc"),
    db: {} as ApiContext["db"],
    sessionService: new SessionService({ repository }),
  }
}

describe("session router current", () => {
  it("rejects unauthenticated requests", async () => {
    const context = createContext(null)
    const sessionRouter = createSessionRouter({
      service: context.sessionService,
    })

    await expect(call(sessionRouter.current, {}, { context })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    })
  })

  it("returns the current authenticated session", async () => {
    const context = createContext(currentSession)
    const sessionRouter = createSessionRouter({
      service: context.sessionService,
    })

    await expect(call(sessionRouter.current, {}, { context })).resolves.toEqual({
      user: {
        id: "user-1",
        email: "user@example.com",
        name: "Example User",
      },
      expiresAt: "2030-01-01T00:00:00.000Z",
    })
  })
})
