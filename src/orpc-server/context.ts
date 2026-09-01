import type { auth as betterAuth } from "@/lib/auth"
import type { AppLogger } from "@/lib/logging"
import type { Database } from "@/db/client"
import type { SessionService } from "@/orpc-server/resource/session/service"

export interface ApiContext {
  auth: typeof betterAuth
  request: Request
  requestId: string
  logger: AppLogger
  db: Database
  sessionService: SessionService
}

export function createApiContext({
  auth,
  request,
  requestId,
  logger,
  db,
  sessionService,
}: {
  auth: typeof betterAuth
  request: Request
  requestId: string
  logger: AppLogger
  db: Database
  sessionService: SessionService
}): ApiContext {
  return {
    auth,
    request,
    requestId,
    logger,
    db,
    sessionService,
  }
}
