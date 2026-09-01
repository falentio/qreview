import { call } from "@orpc/server"
import { describe, expect, it, vi } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { ApiContext } from "@/orpc-server/context"
import { createHealthRouter } from "@/orpc-server/resource/health/router"
import type { HealthRepository } from "@/orpc-server/resource/health/repository"
import { HealthService } from "@/orpc-server/resource/health/service"
import { testLogger } from "@/orpc-server/testing/logger"

describe("health router check", () => {
  it("returns the service health response", async () => {
    const repository = mock<HealthRepository>()
    repository.checkDatabase.mockResolvedValue(undefined)
    const service = new HealthService({ repository })
    const health = createHealthRouter({ service })
    const context = {
      auth: {} as ApiContext["auth"],
      request: new Request("http://localhost/rpc"),
      requestId: "test-request",
      logger: testLogger,
      db: {} as ApiContext["db"],
      sessionService: mock<ApiContext["sessionService"]>(),
    } satisfies ApiContext

    await expect(call(health.check, {}, { context })).resolves.toEqual({
      ok: true,
    })
    expect(repository.checkDatabase.mock.calls).toHaveLength(1)
  })

  it("maps database failures to a service-unavailable error and logs them", async () => {
    const repository = mock<HealthRepository>()
    const error = new Error("D1 unavailable")
    repository.checkDatabase.mockRejectedValue(error)
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
    const health = createHealthRouter({ service: new HealthService({ repository }) })
    const context = {
      auth: {} as ApiContext["auth"],
      request: new Request("http://localhost/rpc"),
      requestId: "test-request",
      logger,
      db: {} as ApiContext["db"],
      sessionService: mock<ApiContext["sessionService"]>(),
    } satisfies ApiContext

    await expect(call(health.check, {}, { context })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      data: { code: "HEALTH_UNAVAILABLE" },
    })
    expect(logger.warn).toHaveBeenCalledWith(expect.any(Error), {
      event: "rpc.failure",
      requestId: "test-request",
    })
  })
})
