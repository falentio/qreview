import { ORPCError } from "@orpc/server"

import { DependencyUnavailableError } from "@/orpc-server/errors"
import { AnalyticsDomainError } from "@/orpc-server/resource/analytics/errors"
import { QrDomainError } from "@/orpc-server/resource/qr/errors"

export const INTERNAL_ERROR_MESSAGE = "Terjadi kesalahan pada server."
export const UNAVAILABLE_ERROR_MESSAGE = "Layanan tidak tersedia untuk sementara."

const expectedOrpcCodes = new Set([
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "METHOD_NOT_SUPPORTED",
  "CONFLICT",
  "UNPROCESSABLE_CONTENT",
  "TOO_MANY_REQUESTS",
])

export function toOrpcError(error: unknown): Error | null {
  if (error instanceof DependencyUnavailableError) {
    return new ORPCError("SERVICE_UNAVAILABLE", {
      message: error.message,
      data: { code: error.code },
    })
  }

  if (error instanceof QrDomainError || error instanceof AnalyticsDomainError) {
    return new ORPCError(error.httpCode, {
      message: error.message,
      data: { code: error.code },
    })
  }

  return null
}

export function isExpectedError(error: unknown): boolean {
  return error instanceof ORPCError && expectedOrpcCodes.has(error.code)
}

export function isUnavailableError(error: unknown): boolean {
  if (error instanceof DependencyUnavailableError) return true

  if (error instanceof QrDomainError || error instanceof AnalyticsDomainError) {
    return error.httpCode === "SERVICE_UNAVAILABLE"
  }

  return error instanceof ORPCError && error.code === "SERVICE_UNAVAILABLE"
}

export function createInternalError(): Error {
  return new ORPCError("INTERNAL_SERVER_ERROR", {
    message: INTERNAL_ERROR_MESSAGE,
    data: { code: "INTERNAL_SERVER_ERROR" },
  })
}

export function createInternalErrorResponse({
  requestId,
  json,
}: {
  requestId: string
  json: boolean
}): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Request-ID": requestId,
  })

  if (json) {
    headers.set("Content-Type", "application/json; charset=utf-8")
    return new Response(
      JSON.stringify({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: INTERNAL_ERROR_MESSAGE,
        },
      }),
      { status: 500, headers },
    )
  }

  return new Response(INTERNAL_ERROR_MESSAGE, { status: 500, headers })
}

export function createUnavailableErrorResponse({
  requestId,
  json,
}: {
  requestId: string
  json: boolean
}): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Retry-After": "60",
    "X-Request-ID": requestId,
  })

  if (json) {
    headers.set("Content-Type", "application/json; charset=utf-8")
    return new Response(
      JSON.stringify({
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: UNAVAILABLE_ERROR_MESSAGE,
        },
      }),
      { status: 503, headers },
    )
  }

  return new Response(UNAVAILABLE_ERROR_MESSAGE, { status: 503, headers })
}
