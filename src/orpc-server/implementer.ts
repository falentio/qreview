import { implement, ORPCError } from "@orpc/server"

import type { ApiContext } from "@/orpc-server/context"
import { apiContract } from "@/orpc-contract"
import { DependencyUnavailableError } from "@/orpc-server/errors"
import {
  createInternalError,
  isExpectedError,
  isUnavailableError,
  toOrpcError,
} from "@/orpc-server/error-policy"
import type { AuthSession } from "@/orpc-server/resource/session/repository"

export const implementer = implement(apiContract).$context<ApiContext>()

export const handleErrors = implementer.middleware(async ({ context, next }) => {
  try {
    return await next()
  } catch (error) {
    const translated = toOrpcError(error)
    if (translated) {
      if (isUnavailableError(error)) logFailure(context, error, "warn")
      throw translated
    }

    if (error instanceof ORPCError) {
      if (!isExpectedError(error)) {
        logFailure(context, error, isUnavailableError(error) ? "warn" : "error")
      }
      if (error.code === "INTERNAL_SERVER_ERROR") throw createInternalError()
      throw error
    }

    logFailure(context, error, "error")
    throw createInternalError()
  }
})

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
      message: "Akses admin global Better Auth diperlukan.",
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
    } catch (error) {
      if (!isMembershipDenied(error)) {
        throw new DependencyUnavailableError(
          "ORGANIZATION_UNAVAILABLE",
          "Layanan organisasi tidak tersedia untuk sementara.",
          { cause: error },
        )
      }

      throw new ORPCError("FORBIDDEN", {
        message: "Anda bukan anggota organisasi ini.",
      })
    }

    if (!role.split(",").some((value) => value.trim() === "owner" || value.trim() === "admin")) {
      throw new ORPCError("FORBIDDEN", {
        message: "Akses pemilik atau admin organisasi diperlukan.",
      })
    }

    return next()
  },
)

function logFailure(
  context: ApiContext,
  error: unknown,
  level: "warn" | "error",
  properties: Record<string, unknown> = {},
): void {
  const normalized = error instanceof Error ? error : new Error(String(error))
  context.logger[level](normalized, {
    event: "rpc.failure",
    requestId: context.requestId,
    ...properties,
  })
}

function isMembershipDenied(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false

  const status = "statusCode" in error ? error.statusCode : "status" in error ? error.status : null
  return status === 403 || status === 404
}
