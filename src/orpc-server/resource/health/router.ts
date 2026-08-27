import { implementer } from "@/orpc-server/implementer"
import type { HealthService } from "@/orpc-server/resource/health/service"

export function createHealthRouter({
  service,
}: {
  service: HealthService
}) {
  return {
    check: implementer.health.check.handler(() => service.check()),
  }
}
