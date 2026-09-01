import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import type { QrEventListener, WaitUntil } from "@/orpc-server/events"
import type { AppLogger } from "@/lib/logging"
import type { QrService } from "@/orpc-server/resource/qr/service"

type PublicLogger = Partial<Pick<AppLogger, "error" | "warn">>

export function createQrPublicResponse({
  service,
  onQrRedirected,
  logger: defaultLogger,
}: {
  service: Pick<QrService, "resolvePublic">
  onQrRedirected?: QrEventListener
  logger?: PublicLogger
}) {
  return async function qrPublicResponse({
    slug,
    waitUntil,
    logger,
  }: {
    slug: string
    waitUntil?: WaitUntil
    logger?: PublicLogger
  }): Promise<Response> {
    const requestLogger = logger ?? defaultLogger
    try {
      const result = await service.resolvePublic({ slug })
      if (result.kind === "expired") {
        return createQrExpiredResponse()
      }
      if (result.kind === "setup") {
        return new Response("Kode QR ini belum dikonfigurasi.", {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        })
      }

      const response = new Response(null, {
        status: 307,
        headers: {
          Location: result.canonicalReviewUrl,
          "Cache-Control": "no-store",
        },
      })

      if (onQrRedirected) {
        const eventDelivery = Promise.resolve()
          .then(() =>
            onQrRedirected({
              type: "qr.redirected",
              qrCodeId: result.qrCodeId,
              occurredAt: new Date(),
            }),
          )
          .catch((error: unknown) => {
            requestLogger?.error?.(error instanceof Error ? error : new Error(String(error)), {
              event: "qr.redirect.analytics_failed",
              qrCodeId: result.qrCodeId,
            })
          })
        if (waitUntil) {
          try {
            waitUntil(eventDelivery)
          } catch (error) {
            requestLogger?.error?.(error instanceof Error ? error : new Error(String(error)), {
              event: "qr.redirect.analytics_scheduling_failed",
              qrCodeId: result.qrCodeId,
            })
            void eventDelivery
          }
        } else {
          void eventDelivery
        }
      }

      return response
    } catch (error) {
      if (error instanceof QrDomainError && error.code === "NOT_FOUND") {
        return createQrNotFoundResponse()
      }
      if (error instanceof QrDomainError && error.code === "PUBLIC_UNAVAILABLE") {
        requestLogger?.warn?.(error, { event: "qr.public.unavailable" })
        return createQrUnavailableResponse()
      }
      throw error
    }
  }
}

export function createQrNotFoundResponse(): Response {
  return new Response("Tidak ditemukan", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  })
}

export function createQrExpiredResponse(): Response {
  return new Response("Kode QR ini sudah kedaluwarsa.", {
    status: 410,
    headers: { "Cache-Control": "no-store" },
  })
}

export function createQrUnavailableResponse(): Response {
  return new Response("Tidak tersedia untuk sementara", {
    status: 503,
    headers: {
      "Cache-Control": "no-store",
      "Retry-After": "60",
    },
  })
}
