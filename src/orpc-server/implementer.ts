import { implement, ORPCError } from "@orpc/server"

import type { ApiContext } from "@/orpc-server/context"
import { apiContract } from "@/orpc-contract"

export const implementer = implement(apiContract).$context<ApiContext>()

export const requireAuth = implementer.middleware(async ({ context, next }) => {
  const currentSession = await context.sessionService.getCurrentSession({
    headers: context.request.headers,
  })

  if (!currentSession) {
    throw new ORPCError("UNAUTHORIZED")
  }

  return next({
    context: {
      user: currentSession.user,
      session: currentSession.session,
    },
  })
})
