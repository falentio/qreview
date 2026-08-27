import type { ContractRouterClient } from "@orpc/contract"

import type { ApiContract } from "@/orpc-contract"

export type SessionClient = ContractRouterClient<ApiContract>["session"]

export function createSessionClient(
  client: ContractRouterClient<ApiContract>,
): SessionClient {
  return client.session
}
