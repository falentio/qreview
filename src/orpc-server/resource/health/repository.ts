import { sql } from "drizzle-orm"

import type { Database } from "@/db/client"

export class HealthRepository {
  constructor(private readonly dependencies: { db: Database }) {}

  async checkDatabase(): Promise<void> {
    await this.dependencies.db.run(sql`select 1`)
  }
}
