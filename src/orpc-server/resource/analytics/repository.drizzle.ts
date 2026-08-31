import { and, eq, gte, lt, sql } from "drizzle-orm"

import type { Database } from "@/db/client"
import { qrAnalyticsHourly, qrCodes } from "@/db/schema"
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

  async listOrganizationHourly({
    organizationId,
    from,
    to,
  }: {
    organizationId: string
    from: Date
    to: Date
  }): Promise<Array<Pick<QrAnalyticsHourlyRecord, "bucketStart" | "redirectAttempts">>> {
    const rows = await this.dependencies.db
      .select({
        bucketStart: qrAnalyticsHourly.bucketStart,
        redirectAttempts: sql<number>`sum(${qrAnalyticsHourly.redirectAttempts})`,
      })
      .from(qrAnalyticsHourly)
      .innerJoin(qrCodes, eq(qrCodes.id, qrAnalyticsHourly.qrCodeId))
      .where(
        and(
          eq(qrCodes.organizationId, organizationId),
          gte(qrAnalyticsHourly.bucketStart, from),
          lt(qrAnalyticsHourly.bucketStart, to),
        ),
      )
      .groupBy(qrAnalyticsHourly.bucketStart)
      .orderBy(qrAnalyticsHourly.bucketStart)

    return rows.map((row) => ({
      bucketStart: row.bucketStart,
      redirectAttempts: Number(row.redirectAttempts),
    }))
  }

  async fillHourly({
    qrCodeId,
    from,
    to,
    redirectAttempts,
  }: {
    qrCodeId: string
    from: Date
    to: Date
    redirectAttempts: number
  }): Promise<number> {
    const statements = []
    for (let bucket = from.getTime(); bucket < to.getTime(); bucket += 60 * 60 * 1000) {
      statements.push(
        this.dependencies.db
          .insert(qrAnalyticsHourly)
          .values({
            qrCodeId,
            bucketStart: new Date(bucket),
            redirectAttempts,
          })
          .onConflictDoUpdate({
            target: [qrAnalyticsHourly.qrCodeId, qrAnalyticsHourly.bucketStart],
            set: { redirectAttempts },
          }),
      )
    }

    if (statements.length > 0) {
      await this.dependencies.db.batch([statements[0]!, ...statements.slice(1)] as const)
    }
    return statements.length
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
