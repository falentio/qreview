import type { ContractRouterClient } from "@orpc/contract"

import type { ApiContract } from "@/orpc-contract"

export type QrClient = ContractRouterClient<ApiContract>["qr"]

export function createQrClient(client: ContractRouterClient<ApiContract>): QrClient {
  return client.qr
}
