import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import type { ContractRouterClient } from "@orpc/contract"

import type { ApiContract } from "@/orpc-contract"

const link = new RPCLink({
  url: () => new URL("/rpc", window.location.origin),
})

export const rpcClient: ContractRouterClient<ApiContract> = createORPCClient(link)
