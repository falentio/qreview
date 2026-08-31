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
  listOrganizationHourly({
    organizationId,
    from,
    to,
  }: {
    organizationId: string
    from: Date
    to: Date
  }): Promise<Array<Pick<QrAnalyticsHourlyRecord, "bucketStart" | "redirectAttempts">>>
  fillHourly({
    qrCodeId,
    from,
    to,
    redirectAttempts,
  }: {
    qrCodeId: string
    from: Date
    to: Date
    redirectAttempts: number
  }): Promise<number>
  deleteOlderThan({ cutoff }: { cutoff: Date }): Promise<number>
}
