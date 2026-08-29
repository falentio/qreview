import { and, eq, gte, lt, sql } from "drizzle-orm"

import type { Database } from "@/db/client"
import { qrAnalyticsHourly } from "@/db/schema"
import type {
  QrAnalyticsHourlyRecord,
  QrAnalyticsRepository,
} from "@/orpc-server/resource/analytics/repository"

const DELETE_BATCH_SIZE = 500

export class DrizzleQrAnalyticsRepository implements QrAnalyticsRepository {
  constructor(private readonly dependencies: { db: Database }) {}

  async incrementRedirectAttempts({
    qrCodeId,
    bucketStart,
  }: {
    qrCodeId: string
    bucketStart: Date
  }): Promise<void> {
    await this.dependencies.db
      .insert(qrAnalyticsHourly)
      .values({ qrCodeId, bucketStart, redirectAttempts: 1 })
      .onConflictDoUpdate({
        target: [qrAnalyticsHourly.qrCodeId, qrAnalyticsHourly.bucketStart],
        set: {
          redirectAttempts: sql`${qrAnalyticsHourly.redirectAttempts} + 1`,
        },
      })
      .run()
  }

  async listHourly({
    qrCodeId,
    from,
    to,
  }: {
    qrCodeId: string
    from: Date
    to: Date
  }): Promise<QrAnalyticsHourlyRecord[]> {
    return this.dependencies.db
      .select()
      .from(qrAnalyticsHourly)
      .where(
        and(
          eq(qrAnalyticsHourly.qrCodeId, qrCodeId),
          gte(qrAnalyticsHourly.bucketStart, from),
          lt(qrAnalyticsHourly.bucketStart, to),
        ),
      )
      .orderBy(qrAnalyticsHourly.bucketStart)
  }

  async deleteOlderThan({ cutoff }: { cutoff: Date }): Promise<number> {
    let deleted = 0
    while (true) {
      const result = await this.dependencies.db.run(sql`
        DELETE FROM qr_analytics_hourly
        WHERE rowid IN (
          SELECT rowid
          FROM qr_analytics_hourly
          WHERE bucket_start < ${cutoff.getTime()}
          LIMIT ${DELETE_BATCH_SIZE}
        )
      `)
      const changes = result.meta.changes
      deleted += changes
      if (changes < DELETE_BATCH_SIZE) return deleted
    }
  }
}
