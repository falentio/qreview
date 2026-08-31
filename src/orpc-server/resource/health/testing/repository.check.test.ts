import { describe, expect, it } from "vite-plus/test"
import type { SQL } from "drizzle-orm"
import { SQLiteDialect } from "drizzle-orm/sqlite-core"
import { mock } from "vitest-mock-extended"

import type { Database } from "@/db/client"
import { HealthRepository } from "@/orpc-server/resource/health/repository"

describe("HealthRepository.checkDatabase", () => {
  it("runs a database health query", async () => {
    const db = mock<Database>()
    db.run.mockResolvedValue({} as never)
    const repository = new HealthRepository({ db })

    await repository.checkDatabase()
    expect(db.run.mock.calls).toHaveLength(1)
    const query = db.run.mock.calls[0]?.[0]
    expect(query).toBeDefined()
    expect(new SQLiteDialect().sqlToQuery(query! as SQL)).toEqual({
      sql: "select 1",
      params: [],
    })
  })
})
