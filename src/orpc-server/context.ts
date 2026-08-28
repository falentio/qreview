import type { auth as betterAuth } from "@/lib/auth"
import type { Database } from "@/db/client"
import type { SessionService } from "@/orpc-server/resource/session/service"

export interface ApiContext {
  auth: typeof betterAuth
  request: Request
  db: Database
  sessionService: SessionService
}

export function createApiContext({
  auth,
  request,
  db,
  sessionService,
}: {
  auth: typeof betterAuth
  request: Request
  db: Database
  sessionService: SessionService
}): ApiContext {
  return {
    auth,
    request,
    db,
    sessionService,
  }
}
