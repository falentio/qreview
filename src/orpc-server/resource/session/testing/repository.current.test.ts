import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import {
  SessionRepository,
  type AuthSession,
  type SessionAuth,
} from "@/orpc-server/resource/session/repository"

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

describe("SessionRepository.getCurrentSession", () => {
  it("loads the current session through Better Auth", async () => {
    const authApi = mock<SessionAuth["api"]>()
    const auth = { api: authApi } satisfies SessionAuth
    authApi.getSession.mockResolvedValue(currentSession)
    const repository = new SessionRepository({ auth })
    const headers = new Headers({ cookie: "session=token" })

    await expect(repository.getCurrentSession({ headers })).resolves.toBe(currentSession)
    expect(authApi.getSession.mock.calls).toEqual([[{ headers }]])
  })
})
