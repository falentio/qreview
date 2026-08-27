import { createSessionRouter } from "@/orpc-server/resource/session/router"
import { SessionRepository, type SessionAuth } from "@/orpc-server/resource/session/repository"
import { SessionService } from "@/orpc-server/resource/session/service"

export function createSession({ auth }: { auth: SessionAuth }) {
  const repository = new SessionRepository({ auth })
  const service = new SessionService({ repository })
  const router = createSessionRouter({ service })

  return { repository, service, router }
}
