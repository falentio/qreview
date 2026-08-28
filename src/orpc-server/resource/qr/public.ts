import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import type { QrService } from "@/orpc-server/resource/qr/service"

export function createQrPublicResponse({ service }: { service: Pick<QrService, "resolvePublic"> }) {
  return async function qrPublicResponse({ slug }: { slug: string }): Promise<Response> {
    try {
      const result = await service.resolvePublic({ slug })
      if (result.kind === "setup") {
        return new Response("This QR code is not configured yet.", {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        })
      }

      return new Response(null, {
        status: 307,
        headers: {
          Location: result.canonicalReviewUrl,
          "Cache-Control": "no-store",
        },
      })
    } catch (error) {
      if (error instanceof QrDomainError && error.code === "NOT_FOUND") {
        return createQrNotFoundResponse()
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
