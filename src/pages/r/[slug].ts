import type { APIRoute } from "astro"

import { qrService } from "@/orpc-server"
import { createQrPublicResponse } from "@/orpc-server/resource/qr/public"

export const prerender = false

export const GET: APIRoute = ({ params }) => {
  if (!params.slug) return new Response("Not found", { status: 404 })
  return createQrPublicResponse({ service: qrService, slug: params.slug })
}
