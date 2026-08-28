import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import { createSession } from "@/orpc-server/resource/session"
import {
  SessionRepository,
  type AuthSession,
  type SessionAuth,
} from "@/orpc-server/resource/session/repository"
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

describe("createSession", () => {
  it("composes the three resource layers around the injected auth adapter", async () => {
    const authApi = mock<SessionAuth["api"]>()
    const auth = { api: authApi } satisfies SessionAuth
    authApi.getSession.mockResolvedValue(currentSession)

    const session = createSession({ auth })

    expect(session.repository).toBeInstanceOf(SessionRepository)
    expect(session.service).toBeInstanceOf(SessionService)
    expect(session.router.current).toBeDefined()
    await expect(session.service.getCurrentSession({ headers: new Headers() })).resolves.toBe(
      currentSession,
    )
    expect(authApi.getSession).toHaveBeenCalledWith({ headers: new Headers() })
  })
})
