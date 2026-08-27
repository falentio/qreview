import type { ContractRouterClient } from "@orpc/contract"

import type { ApiContract } from "@/orpc-contract"

export type HealthClient = ContractRouterClient<ApiContract>["health"]

export function createHealthClient(
  client: ContractRouterClient<ApiContract>,
): HealthClient {
  return client.health
}
