import type { Database } from "@/db/client"
import { createQrRouter } from "@/orpc-server/resource/qr/router"
import { type PlacesAdapter } from "@/orpc-server/resource/qr/places"
import { generateQrId, generateQrSlug } from "@/orpc-server/resource/qr/random"
import { QrRepository } from "@/orpc-server/resource/qr/repository"
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
  const repository = new QrRepository({ db })
  const service = new QrService({
    repository,
    places,
    clock,
    ids: { generateId: generateQrId, generateSlug: generateQrSlug },
  })
  const router = createQrRouter({ service })

  return { repository, service, router }
}
