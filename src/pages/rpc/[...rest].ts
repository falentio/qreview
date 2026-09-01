import { RPCHandler } from "@orpc/server/fetch"
import type { APIRoute } from "astro"

import { createApiContext, router } from "@/orpc-server"

const handler = new RPCHandler(router)

export const prerender = false

export const ALL: APIRoute = async ({ request, locals }) => {
  const result = await handler.handle(request, {
    prefix: "/rpc",
    context: createApiContext({
      request,
      requestId: locals.requestId,
      logger: locals.logger,
    }),
  })

  return result.response ?? new Response("Not found", { status: 404 })
}
