import { auth, db } from "@/lib/auth"
import { createApiContext as createContext } from "@/orpc-server/context"
import { implementer } from "@/orpc-server/implementer"
import { createHealthRouter } from "@/orpc-server/resource/health/router"
import { HealthRepository } from "@/orpc-server/resource/health/repository"
import { HealthService } from "@/orpc-server/resource/health/service"
import { createSessionRouter } from "@/orpc-server/resource/session/router"
import { SessionRepository } from "@/orpc-server/resource/session/repository"
import { SessionService } from "@/orpc-server/resource/session/service"

const healthRepository = new HealthRepository({ db })
const healthService = new HealthService({ repository: healthRepository })
const sessionRepository = new SessionRepository({ auth })
const sessionService = new SessionService({ repository: sessionRepository })

export const router = implementer.router({
  health: createHealthRouter({ service: healthService }),
  session: createSessionRouter({ service: sessionService }),
})

export type AppRouter = typeof router

export function createApiContext({ request }: { request: Request }) {
  return createContext({ request, db, sessionService })
}
