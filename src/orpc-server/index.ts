import { auth, db } from "@/lib/auth"
import { getAppLogger } from "@/lib/logging"
import { env, waitUntil } from "cloudflare:workers"
import { createApiContext as createContext } from "@/orpc-server/context"
import { implementer } from "@/orpc-server/implementer"
import { createAnalytics } from "@/orpc-server/resource/analytics"
import { createHealth } from "@/orpc-server/resource/health"
import { createQr } from "@/orpc-server/resource/qr"
import { CloudflareKvJsonCache } from "@/orpc-server/resource/qr/cache"
import { CloudflareQrPublicProjectionCache } from "@/orpc-server/resource/qr/public-cache"
import { CachedPlacesAdapter } from "@/orpc-server/resource/qr/places-cache"
import { GooglePlacesAdapter } from "@/orpc-server/resource/qr/places"
import { DrizzleQrRepository } from "@/orpc-server/resource/qr/repository.drizzle"
import { createSession } from "@/orpc-server/resource/session"

const qrRepository = new DrizzleQrRepository({ db })
const logger = getAppLogger(["qr"])
const cacheLogger = getAppLogger(["qr", "cache"])
const analyticsResource = createAnalytics({ db, qrRepository })
const healthResource = createHealth({ db })
const qrResource = createQr({
  db,
  places: new CachedPlacesAdapter({
    places: new GooglePlacesAdapter({ apiKey: env.GOOGLE_MAPS_API_KEY, logger }),
    cache: new CloudflareKvJsonCache({
      namespace: env.PLACES_CACHE,
      waitUntil,
      logger: cacheLogger,
    }),
    logger: cacheLogger,
  }),
  publicProjection: new CloudflareQrPublicProjectionCache({
    namespace: env.QR_PUBLIC_PROJECTION,
    waitUntil,
    logger: cacheLogger,
  }),
  onQrRedirected: analyticsResource.listener,
  repository: qrRepository,
  logger,
})
const sessionResource = createSession({ auth })

export const router = implementer.router({
  analytics: analyticsResource.router,
  health: healthResource.router,
  qr: qrResource.router,
  session: sessionResource.router,
})

export type AppRouter = typeof router

export const qrService = qrResource.service
export const qrPublicResponse = qrResource.publicResponse
export const analyticsService = analyticsResource.service

export function createApiContext({
  request,
  requestId,
  logger,
}: {
  request: Request
  requestId: string
  logger: Parameters<typeof createContext>[0]["logger"]
}) {
  return createContext({
    auth,
    request,
    requestId,
    logger,
    db,
    sessionService: sessionResource.service,
  })
}
