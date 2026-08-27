import { call } from "@orpc/server"
import { describe, expect, it } from "vitest"

import type { ApiContext } from "@/api/context"
import { createHealth } from "@/api/resources/health"
import { createSession } from "@/api/resources/session"

const context = {
  request: new Request("http://localhost/rpc"),
  db: {} as ApiContext["db"],
  user: null,
  session: null,
} satisfies ApiContext

describe("API resources", () => {
  it("returns a health response", async () => {
    const result = await call(createHealth().check, {}, { context })

    expect(result).toEqual({ ok: true })
  })

  it("rejects the current session when unauthenticated", async () => {
    await expect(
      call(createSession().current, {}, { context }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    })
  })
})
