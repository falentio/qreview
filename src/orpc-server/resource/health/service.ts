import { DependencyUnavailableError } from "@/orpc-server/errors"
import type { HealthRepository } from "@/orpc-server/resource/health/repository"

export class HealthService {
  constructor(private readonly dependencies: { repository: HealthRepository }) {}

  async check(): Promise<{ ok: true }> {
    try {
      await this.dependencies.repository.checkDatabase()
    } catch (error) {
      throw new DependencyUnavailableError(
        "HEALTH_UNAVAILABLE",
        "Layanan kesehatan tidak tersedia untuk sementara.",
        { cause: error },
      )
    }

    return { ok: true }
  }
}
