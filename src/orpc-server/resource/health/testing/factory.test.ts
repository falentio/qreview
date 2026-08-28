import { call } from "@orpc/server"
import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { ApiContext } from "@/orpc-server/context"
import type { Database } from "@/db/client"
import { createHealth } from "@/orpc-server/resource/health"

describe("createHealth", () => {
  it("composes the three resource layers around the injected database", async () => {
    const db = mock<Database>()
    db.run.mockResolvedValue({} as never)

    const health = createHealth({ db })
    const context = {
      auth: {} as ApiContext["auth"],
      request: new Request("http://localhost/rpc"),
      db,
      sessionService: mock<ApiContext["sessionService"]>(),
    } satisfies ApiContext

    await expect(call(health.router.check, {}, { context })).resolves.toEqual({ ok: true })
    expect(db.run.mock.calls).toHaveLength(1)
  })
})
