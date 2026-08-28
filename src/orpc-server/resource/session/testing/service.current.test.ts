import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

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

describe("SessionService.getCurrentSession", () => {
  it("delegates session lookup to the repository", async () => {
    const repository = mock<SessionRepository>()
    repository.getCurrentSession.mockResolvedValue(currentSession)
    const service = new SessionService({ repository })
    const headers = new Headers({ cookie: "session=token" })

    await expect(service.getCurrentSession({ headers })).resolves.toBe(currentSession)
    expect(repository.getCurrentSession.mock.calls).toEqual([[{ headers }]])
  })
})

describe("SessionService.toCurrentSessionResponse", () => {
  it("maps the authenticated session to the contract response", () => {
    const repository = mock<SessionRepository>()
    const service = new SessionService({ repository })

    expect(service.toCurrentSessionResponse(currentSession)).toEqual({
      user: {
        id: "user-1",
        email: "user@example.com",
        name: "Example User",
      },
      expiresAt: "2030-01-01T00:00:00.000Z",
    })
  })
})
