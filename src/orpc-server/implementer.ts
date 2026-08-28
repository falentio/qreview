import { implement, ORPCError } from "@orpc/server"

import type { ApiContext } from "@/orpc-server/context"
import { apiContract } from "@/orpc-contract"
import type { AuthSession } from "@/orpc-server/resource/session/repository"

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

type AuthenticatedContext = ApiContext & Pick<AuthSession, "user" | "session">

export const requireGlobalAdmin = implementer.middleware(({ context, next }) => {
  const { user } = context as AuthenticatedContext
  if (user.role !== "admin") {
    throw new ORPCError("FORBIDDEN", {
      message: "Global Better Auth admin access is required.",
    })
  }

  return next()
})

export const requireOrgsAdmin = implementer.middleware(
  async ({ context, next }, input: { organizationId: string }) => {
    let role: string
    try {
      const membership = await context.auth.api.getActiveMemberRole({
        headers: context.request.headers,
        query: { organizationId: input.organizationId },
      })
      role = membership.role
    } catch {
      throw new ORPCError("FORBIDDEN", {
        message: "You are not a member of this organization.",
      })
    }

    if (!role.split(",").some((value) => value.trim() === "owner" || value.trim() === "admin")) {
      throw new ORPCError("FORBIDDEN", {
        message: "Organization owner or admin access is required.",
      })
    }

    return next()
  },
)
