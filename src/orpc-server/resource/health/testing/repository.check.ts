import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { Database } from "@/db/client"
import { HealthRepository } from "@/orpc-server/resource/health/repository"

describe("HealthRepository.checkDatabase", () => {
  it("runs a database health query", async () => {
    const db = mock<Database>()
    db.run.mockResolvedValue({} as never)
    const repository = new HealthRepository({ db })

    await expect(repository.checkDatabase()).resolves.toBeUndefined()
    expect(db.run).toHaveBeenCalledOnce()
  })
})
