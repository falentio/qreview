import type { APIRoute } from "astro"

import { qrPublicResponse } from "@/orpc-server"
import { createQrNotFoundResponse } from "@/orpc-server/resource/qr/public"

export const prerender = false

export const GET: APIRoute = ({ params }) => {
  if (!params.slug) return createQrNotFoundResponse()
  return qrPublicResponse({ slug: params.slug })
}
