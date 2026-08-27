import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import type { RouterClient } from "@orpc/server"

import type { AppRouter } from "@/api/router"

const link = new RPCLink({
  url: () => new URL("/rpc", window.location.origin),
})

export const rpcClient: RouterClient<AppRouter> = createORPCClient(link)
