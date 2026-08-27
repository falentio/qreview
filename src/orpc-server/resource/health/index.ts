import type { Database } from "@/db/client"
import { createHealthRouter } from "@/orpc-server/resource/health/router"
import { HealthRepository } from "@/orpc-server/resource/health/repository"
import { HealthService } from "@/orpc-server/resource/health/service"

export function createHealth({ db }: { db: Database }) {
  const repository = new HealthRepository({ db })
  const service = new HealthService({ repository })
  const router = createHealthRouter({ service })

  return { repository, service, router }
}
