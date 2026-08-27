import { implement, ORPCError } from "@orpc/server"

import type { ApiContext } from "@/api/context"
import { apiContract } from "@/api/contract"

export const implementer = implement(apiContract).$context<ApiContext>()

export const requireAuth = implementer.middleware(async ({ context, next }) => {
  if (!context.user || !context.session) {
    throw new ORPCError("UNAUTHORIZED")
  }

  return next({
    context: {
      user: context.user,
      session: context.session,
    },
  })
})
