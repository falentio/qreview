import { auth, db } from "@/lib/auth"
import { createApiContext as createContext } from "@/orpc-server/context"
import { implementer } from "@/orpc-server/implementer"
import { createHealth } from "@/orpc-server/resource/health"
import { createSession } from "@/orpc-server/resource/session"

const healthResource = createHealth({ db })
const sessionResource = createSession({ auth })

export const router = implementer.router({
  health: healthResource.router,
  session: sessionResource.router,
})

export type AppRouter = typeof router

export function createApiContext({ request }: { request: Request }) {
  return createContext({ request, db, sessionService: sessionResource.service })
}
