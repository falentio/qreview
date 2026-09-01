import type { Database } from "@/db/client"
import type { AppLogger } from "@/lib/logging"
import type { QrEventListener } from "@/orpc-server/events"
import { createQrPublicResponse } from "@/orpc-server/resource/qr/public"
import type { QrPublicProjectionStore } from "@/orpc-server/resource/qr/public-cache"
import { createQrRouter } from "@/orpc-server/resource/qr/router"
import { generateQrId, generateQrSlug } from "@/orpc-server/resource/qr/random"
import { DrizzleQrRepository } from "@/orpc-server/resource/qr/repository.drizzle"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"
import { QrService } from "@/orpc-server/resource/qr/service"

export function createQr({
  db,
  clock,
  onQrRedirected,
  publicProjection,
  repository: providedRepository,
  logger,
}: {
  db: Database
  clock?: { now(): Date }
  onQrRedirected?: QrEventListener
  publicProjection?: QrPublicProjectionStore
  repository?: QrRepository
  logger?: AppLogger
}) {
  const repository: QrRepository = providedRepository ?? new DrizzleQrRepository({ db })
  const service = new QrService({
    repository,
    publicProjection,
    clock,
    ids: { generateId: generateQrId, generateSlug: generateQrSlug },
    logger,
  })
  const router = createQrRouter({ service })
  const publicResponse = createQrPublicResponse({ service, onQrRedirected, logger })

  return { repository, service, router, publicResponse }
}
