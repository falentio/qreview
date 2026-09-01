import { describe, expect, it } from "vite-plus/test"

import { ORPCError } from "@orpc/server"

import {
  createInternalError,
  createInternalErrorResponse,
  createUnavailableErrorResponse,
  isExpectedError,
  isUnavailableError,
  toOrpcError,
} from "@/orpc-server/error-policy"
import { QrDomainError } from "@/orpc-server/resource/qr/errors"

describe("error policy", () => {
  it("translates domain errors without exposing their causes", () => {
    const error = new QrDomainError("PLACE_RESOLUTION_FAILED", "Lokasi tidak ditemukan.", {
      cause: new Error("provider details"),
    })

    const translated = toOrpcError(error)

    expect(translated).toMatchObject({
      code: "BAD_REQUEST",
      message: "Lokasi tidak ditemukan.",
      data: { code: "PLACE_RESOLUTION_FAILED" },
    })
    expect(translated).not.toHaveProperty("cause")
  })

  it("classifies expected and unavailable errors separately", () => {
    expect(isExpectedError(new ORPCError("FORBIDDEN"))).toBe(true)
    expect(isExpectedError(new ORPCError("INTERNAL_SERVER_ERROR"))).toBe(false)
    expect(isUnavailableError(new ORPCError("SERVICE_UNAVAILABLE"))).toBe(true)
    expect(isUnavailableError(new Error("database down"))).toBe(false)
  })

  it("creates a generic internal error", () => {
    expect(createInternalError()).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Terjadi kesalahan pada server.",
      data: { code: "INTERNAL_SERVER_ERROR" },
    })
  })

  it("returns a safe JSON error response with the request ID", async () => {
    const response = createInternalErrorResponse({ requestId: "trace-123", json: true })

    expect(response.status).toBe(500)
    expect(response.headers.get("X-Request-ID")).toBe("trace-123")
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Terjadi kesalahan pada server.",
      },
    })
  })

  it("returns a retryable unavailable response with the request ID", async () => {
    const response = createUnavailableErrorResponse({ requestId: "trace-123", json: true })

    expect(response.status).toBe(503)
    expect(response.headers.get("Retry-After")).toBe("60")
    expect(response.headers.get("X-Request-ID")).toBe("trace-123")
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Layanan tidak tersedia untuk sementara.",
      },
    })
  })
})
