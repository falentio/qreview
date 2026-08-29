import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import type { QrEventListener, WaitUntil } from "@/orpc-server/events"
import type { QrService } from "@/orpc-server/resource/qr/service"

export function createQrPublicResponse({
  service,
  onQrRedirected,
}: {
  service: Pick<QrService, "resolvePublic">
  onQrRedirected?: QrEventListener
}) {
  return async function qrPublicResponse({
    slug,
    waitUntil,
  }: {
    slug: string
    waitUntil?: WaitUntil
  }): Promise<Response> {
    try {
      const result = await service.resolvePublic({ slug })
      if (result.kind === "setup") {
        return new Response("This QR code is not configured yet.", {
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
            console.error("QR redirect analytics failed", error)
          })
        if (waitUntil) {
          try {
            waitUntil(eventDelivery)
          } catch (error) {
            console.error("QR redirect analytics scheduling failed", error)
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
        return createQrUnavailableResponse()
      }
      throw error
    }
  }
}

export function createQrNotFoundResponse(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  })
}

export function createQrUnavailableResponse(): Response {
  return new Response("Temporarily unavailable", {
    status: 503,
    headers: {
      "Cache-Control": "no-store",
      "Retry-After": "60",
    },
  })
}
