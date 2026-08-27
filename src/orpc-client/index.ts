import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import type { ContractRouterClient } from "@orpc/contract"

import type { ApiContract } from "@/orpc-contract"
import { createHealthClient } from "@/orpc-client/resource/health"
import { createSessionClient } from "@/orpc-client/resource/session"

const link = new RPCLink({
  url: () => new URL("/rpc", window.location.origin),
})

export const rpcClient: ContractRouterClient<ApiContract> =
  createORPCClient(link)

export const healthClient = createHealthClient(rpcClient)
export const sessionClient = createSessionClient(rpcClient)
