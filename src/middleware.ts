import { defineMiddleware } from "astro:middleware"

import { configureLogging, createRequestContext, withRequestId } from "@/lib/logging"
import {
  createInternalErrorResponse,
  createUnavailableErrorResponse,
  isUnavailableError,
} from "@/orpc-server/error-policy"
import { auth } from "@/lib/auth"
import { DependencyUnavailableError } from "@/orpc-server/errors"

export const onRequest = defineMiddleware(async (context, next) => {
  const requestContext = createRequestContext(context.request)
  const startedAt = Date.now()
  context.locals.requestId = requestContext.requestId
  context.locals.logger = requestContext.logger

  const finish = (response: Response): Response => {
    requestContext.logger.info("Request completed.", {
      event: "request.completed",
      requestId: requestContext.requestId,
      method: context.request.method,
      pathname: context.url.pathname,
      status: response.status,
      durationMs: Date.now() - startedAt,
    })
    return withRequestId(response, requestContext.requestId)
  }

  try {
    await configureLogging()

    const isQrRoute = context.url.pathname === "/r" || context.url.pathname.startsWith("/r/")
    const isRpcRoute = context.url.pathname === "/rpc" || context.url.pathname.startsWith("/rpc/")
    const isAuthRoute =
      context.url.pathname === "/api/auth" || context.url.pathname.startsWith("/api/auth/")
    if (isQrRoute || isRpcRoute || isAuthRoute) {
      return finish(await next())
    }

    const currentSession = await auth.api.getSession({
      headers: context.request.headers,
    })

    context.locals.user = currentSession?.user ?? null
    context.locals.session = currentSession?.session ?? null

    const isAppRoute = context.url.pathname === "/app" || context.url.pathname.startsWith("/app/")
    const isAdminRoute =
      context.url.pathname === "/admin" || context.url.pathname.startsWith("/admin/")

    if (isAdminRoute) {
      if (!currentSession) {
        return finish(Response.redirect(new URL("/login", context.url), 302))
      }

      if (currentSession.user.role !== "admin") {
        return finish(Response.redirect(new URL("/app", context.url), 302))
      }
    }

    if (isAppRoute) {
      if (!currentSession) {
        return finish(Response.redirect(new URL("/login", context.url), 302))
      }

      let organizations: Awaited<ReturnType<typeof auth.api.listOrganizations>>
      try {
        organizations = await auth.api.listOrganizations({
          headers: context.request.headers,
        })
      } catch (error) {
        throw new DependencyUnavailableError(
          "ORGANIZATION_UNAVAILABLE",
          "Layanan organisasi tidak tersedia untuk sementara.",
          { cause: error },
        )
      }
      if (!organizations?.length) {
        return finish(Response.redirect(new URL("/onboarding/organization", context.url), 302))
      }
    }

    return finish(await next())
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error))
    const failureProperties = {
      event: "request.unhandled",
      requestId: requestContext.requestId,
      method: context.request.method,
      pathname: context.url.pathname,
    }
    if (isUnavailableError(error)) {
      requestContext.logger.warn(normalized, failureProperties)
    } else {
      requestContext.logger.error(normalized, failureProperties)
    }

    const isApiRoute =
      context.url.pathname === "/rpc" ||
      context.url.pathname.startsWith("/rpc/") ||
      context.url.pathname === "/api/auth" ||
      context.url.pathname.startsWith("/api/auth/")
    if (isApiRoute || context.url.pathname === "/r" || context.url.pathname.startsWith("/r/")) {
      return finish(
        isUnavailableError(error)
          ? createUnavailableErrorResponse({
              requestId: requestContext.requestId,
              json: isApiRoute,
            })
          : createInternalErrorResponse({ requestId: requestContext.requestId, json: isApiRoute }),
      )
    }

    if (isUnavailableError(error)) {
      return finish(
        createUnavailableErrorResponse({ requestId: requestContext.requestId, json: false }),
      )
    }

    throw error
  }
})
