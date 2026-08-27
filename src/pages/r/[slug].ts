import type { APIRoute } from "astro"

import { qrService } from "@/orpc-server"
import { createQrNotFoundResponse, createQrPublicResponse } from "@/orpc-server/resource/qr/public"

export const prerender = false

export const GET: APIRoute = ({ params }) => {
  if (!params.slug) return createQrNotFoundResponse()
  return createQrPublicResponse({ service: qrService, slug: params.slug })
}
