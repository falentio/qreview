import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import { HealthService } from "@/orpc-server/resource/health/service"
import type { HealthRepository } from "@/orpc-server/resource/health/repository"

describe("HealthService.check", () => {
  it("returns a healthy response after the repository succeeds", async () => {
    const repository = mock<HealthRepository>()
    repository.checkDatabase.mockResolvedValue(undefined)
    const service = new HealthService({ repository })

    await expect(service.check()).resolves.toEqual({ ok: true })
    expect(repository.checkDatabase).toHaveBeenCalledOnce()
  })
})
