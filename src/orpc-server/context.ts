import type { Database } from "@/db/client"
import type { SessionService } from "@/orpc-server/resource/session/service"

export interface ApiContext {
  request: Request
  db: Database
  sessionService: SessionService
}

export function createApiContext({
  request,
  db,
  sessionService,
}: {
  request: Request
  db: Database
  sessionService: SessionService
}): ApiContext {
  return {
    request,
    db,
    sessionService,
  }
}
