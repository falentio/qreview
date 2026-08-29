import type { Database } from "@/db/client"
import type { QrEventListener } from "@/orpc-server/events"
import { createQrPublicResponse } from "@/orpc-server/resource/qr/public"
import { createQrRouter } from "@/orpc-server/resource/qr/router"
import { type PlacesAdapter } from "@/orpc-server/resource/qr/places"
import { generateQrId, generateQrSlug } from "@/orpc-server/resource/qr/random"
import { DrizzleQrRepository } from "@/orpc-server/resource/qr/repository.drizzle"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"
import { QrService } from "@/orpc-server/resource/qr/service"

export function createQr({
  db,
  places,
  clock,
  onQrRedirected,
  repository: providedRepository,
}: {
  db: Database
  places: PlacesAdapter
  clock?: { now(): Date }
  onQrRedirected?: QrEventListener
  repository?: QrRepository
}) {
  const repository: QrRepository = providedRepository ?? new DrizzleQrRepository({ db })
  const service = new QrService({
    repository,
    places,
    clock,
    ids: { generateId: generateQrId, generateSlug: generateQrSlug },
  })
  const router = createQrRouter({ service })
  const publicResponse = createQrPublicResponse({ service, onQrRedirected })

  return { repository, service, router, publicResponse }
}
