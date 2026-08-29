import { qrAnalyticsHourly } from "@/db/schema"

export type QrAnalyticsHourlyRecord = typeof qrAnalyticsHourly.$inferSelect

export interface QrAnalyticsRepository {
  incrementRedirectAttempts({
    qrCodeId,
    bucketStart,
  }: {
    qrCodeId: string
    bucketStart: Date
  }): Promise<void>
  listHourly({
    qrCodeId,
    from,
    to,
  }: {
    qrCodeId: string
    from: Date
    to: Date
  }): Promise<QrAnalyticsHourlyRecord[]>
  deleteOlderThan({ cutoff }: { cutoff: Date }): Promise<number>
}
