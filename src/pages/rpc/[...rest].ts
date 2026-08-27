import { RPCHandler } from "@orpc/server/fetch"
import type { APIRoute } from "astro"

import { createApiContext } from "@/api/context"
import { router } from "@/api/router"

const handler = new RPCHandler(router)

export const prerender = false

export const ALL: APIRoute = async ({ request }) => {
  const result = await handler.handle(request, {
    prefix: "/rpc",
    context: await createApiContext({ request }),
  })

  return result.response ?? new Response("Not found", { status: 404 })
}
