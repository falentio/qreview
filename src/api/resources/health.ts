import { implementer } from "@/api/implementer"

export function createHealth() {
  return {
    check: implementer.health.check.handler(() => ({ ok: true as const })),
  }
}
