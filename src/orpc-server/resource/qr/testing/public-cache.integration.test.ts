import { env } from "cloudflare:workers"
import { describe, expect, it } from "vite-plus/test"

import {
  CloudflareQrPublicProjectionCache,
  type QrPublicProjection,
} from "@/orpc-server/resource/qr/public-cache"

describe("QR public projection KV binding", () => {
  it("stores and serves a projection through the configured KV namespace", async () => {
    const projection: QrPublicProjection = {
      schemaVersion: 2,
      slug: `intg${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`,
      qrCodeId: `integration-${crypto.randomUUID()}`,
      state: "active",
      googlePlaceId: "ChIJ123456789",
      canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ123456789",
      expiresAt: null,
      updatedAt: "2030-01-01T00:00:00.000Z",
    }
    const writes: Promise<unknown>[] = []
    const cache = new CloudflareQrPublicProjectionCache({
      namespace: env.QR_PUBLIC_PROJECTION,
      waitUntil: (promise) => writes.push(promise),
    })

    cache.set(projection)
    await Promise.all(writes)

    await expect(cache.get({ slug: projection.slug })).resolves.toEqual(projection)
  })
})
