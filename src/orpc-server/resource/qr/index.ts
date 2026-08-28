import type { Database } from "@/db/client"
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
}: {
  db: Database
  places: PlacesAdapter
  clock?: { now(): Date }
}) {
  const repository: QrRepository = new DrizzleQrRepository({ db })
  const service = new QrService({
    repository,
    places,
    clock,
    ids: { generateId: generateQrId, generateSlug: generateQrSlug },
  })
  const router = createQrRouter({ service })
  const publicResponse = createQrPublicResponse({ service })

  return { repository, service, router, publicResponse }
}
