import type { Database } from "@/db/client"
import type { QrEventListener } from "@/orpc-server/events"
import { createAnalyticsRouter } from "@/orpc-server/resource/analytics/router"
import { DrizzleQrAnalyticsRepository } from "@/orpc-server/resource/analytics/repository.drizzle"
import { AnalyticsService } from "@/orpc-server/resource/analytics/service"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"

export function createAnalytics({
  db,
  qrRepository,
  clock,
}: {
  db: Database
  qrRepository: Pick<QrRepository, "findById" | "findBySlug" | "getOrganizationMemberRole">
  clock?: { now(): Date }
}) {
  const repository = new DrizzleQrAnalyticsRepository({ db })
  const service = new AnalyticsService({ repository, qrRepository, clock })
  const router = createAnalyticsRouter({ service })
  const listener: QrEventListener = (event) => service.recordRedirect(event)

  return { repository, service, router, listener }
}
