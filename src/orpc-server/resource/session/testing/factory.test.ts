import { call } from "@orpc/server"
import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { ApiContext } from "@/orpc-server/context"
import { createSession } from "@/orpc-server/resource/session"
import type { AuthSession, SessionAuth } from "@/orpc-server/resource/session/repository"
import { testLogger } from "@/orpc-server/testing/logger"

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
    const request = new Request("http://localhost/rpc", {
      headers: { cookie: "session=token" },
    })
    const context = {
      auth: {} as ApiContext["auth"],
      request,
      requestId: "test-request",
      logger: testLogger,
      db: {} as ApiContext["db"],
      sessionService: session.service,
    } satisfies ApiContext

    await expect(call(session.router.current, {}, { context })).resolves.toEqual({
      user: {
        id: "user-1",
        email: "user@example.com",
        name: "Example User",
      },
      expiresAt: "2030-01-01T00:00:00.000Z",
    })
    expect(authApi.getSession.mock.calls).toEqual([[{ headers: request.headers }]])
  })
})
