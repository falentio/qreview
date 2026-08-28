import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { Database } from "@/db/client"
import { createHealth } from "@/orpc-server/resource/health"
import { HealthRepository } from "@/orpc-server/resource/health/repository"
import { HealthService } from "@/orpc-server/resource/health/service"

describe("createHealth", () => {
  it("composes the three resource layers around the injected database", async () => {
    const db = mock<Database>()
    db.run.mockResolvedValue({} as never)

    const health = createHealth({ db })

    expect(health.repository).toBeInstanceOf(HealthRepository)
    expect(health.service).toBeInstanceOf(HealthService)
    expect(health.router.check).toBeDefined()
    await expect(health.service.check()).resolves.toEqual({ ok: true })
  })
})
