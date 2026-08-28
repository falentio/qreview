import { auth, db } from "@/lib/auth"
import { env } from "cloudflare:workers"
import { createApiContext as createContext } from "@/orpc-server/context"
import { implementer } from "@/orpc-server/implementer"
import { createHealth } from "@/orpc-server/resource/health"
import { createQr } from "@/orpc-server/resource/qr"
import { GooglePlacesAdapter } from "@/orpc-server/resource/qr/places"
import { createSession } from "@/orpc-server/resource/session"

const healthResource = createHealth({ db })
const qrResource = createQr({
  db,
  places: new GooglePlacesAdapter({ apiKey: env.GOOGLE_MAPS_API_KEY }),
})
const sessionResource = createSession({ auth })

export const router = implementer.router({
  health: healthResource.router,
  qr: qrResource.router,
  session: sessionResource.router,
})

export type AppRouter = typeof router

export const qrService = qrResource.service
export const qrPublicResponse = qrResource.publicResponse

export function createApiContext({ request }: { request: Request }) {
  return createContext({ auth, request, db, sessionService: sessionResource.service })
}
