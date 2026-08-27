import type { HealthRepository } from "@/orpc-server/resource/health/repository"

export class HealthService {
  constructor(
    private readonly dependencies: { repository: HealthRepository },
  ) {}

  async check(): Promise<{ ok: true }> {
    await this.dependencies.repository.checkDatabase()

    return { ok: true }
  }
}
