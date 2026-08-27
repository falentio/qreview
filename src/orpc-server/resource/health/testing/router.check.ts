import { call } from "@orpc/server"
import { describe, expect, it } from "vitest"
import { mock } from "vitest-mock-extended"

import type { ApiContext } from "@/orpc-server/context"
import { createHealthRouter } from "@/orpc-server/resource/health/router"
import type { HealthRepository } from "@/orpc-server/resource/health/repository"
import { HealthService } from "@/orpc-server/resource/health/service"

describe("health router check", () => {
  it("returns the service health response", async () => {
    const repository = mock<HealthRepository>()
    repository.checkDatabase.mockResolvedValue(undefined)
    const service = new HealthService({ repository })
    const health = createHealthRouter({ service })
    const context = {
      request: new Request("http://localhost/rpc"),
      db: {} as ApiContext["db"],
      sessionService: mock<ApiContext["sessionService"]>(),
    } satisfies ApiContext

    await expect(call(health.check, {}, { context })).resolves.toEqual({
      ok: true,
    })
    expect(repository.checkDatabase).toHaveBeenCalledOnce()
  })
})
