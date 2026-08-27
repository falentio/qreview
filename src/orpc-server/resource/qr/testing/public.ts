import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import { createQrNotFoundResponse, createQrPublicResponse } from "@/orpc-server/resource/qr/public"
import type { PlacesAdapter } from "@/orpc-server/resource/qr/places"
import { createQrRecord } from "@/orpc-server/resource/qr/fixtures"
import type { QrRecord, QrRepository } from "@/orpc-server/resource/qr/repository"
import { QrService } from "@/orpc-server/resource/qr/service"

function setup(record: QrRecord | null) {
  const repository = mock<QrRepository>()
  const places = mock<PlacesAdapter>()
  repository.findBySlug.mockResolvedValue(record)
  const service = new QrService({
    repository,
    places,
    ids: {
      generateId: () => "generated-id",
      generateSlug: () => "generated1a",
    },
  })
  return service
}

describe("createQrPublicResponse", () => {
  it("redirects active QR codes without allowing the redirect to be cached", async () => {
    const service = setup(createQrRecord())

    const response = await createQrPublicResponse({ service, slug: "abc123def4" })

    expect(response.status).toBe(307)
    expect(response.headers.get("Location")).toBe(
      "https://search.google.com/local/writereview?placeid=ChIJ123456789",
    )
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })

  it("returns a neutral setup response for orphan or incomplete QR codes", async () => {
    for (const record of [
      createQrRecord({ organizationId: null }),
      createQrRecord({ rawGoogleMapsUrl: null }),
    ]) {
      const service = setup(record)

      const response = await createQrPublicResponse({ service, slug: "abc123def4" })

      expect(response.status).toBe(200)
      expect(await response.text()).toContain("not configured")
    }
  })

  it("does not redirect to an invalid stored canonical URL", async () => {
    for (const canonicalReviewUrl of [
      "https://evil.google.com/not-a-review",
      "https://search.google.com/local/writereview?placeid=ChIJ987654321",
    ]) {
      const service = setup(createQrRecord({ canonicalReviewUrl }))

      const response = await createQrPublicResponse({ service, slug: "abc123def4" })

      expect(response.status).toBe(200)
      expect(await response.text()).toContain("not configured")
    }
  })

  it("returns 404 for archived or missing QR codes", async () => {
    for (const record of [null, createQrRecord({ deletedAt: new Date() })]) {
      const service = setup(record)

      const response = await createQrPublicResponse({ service, slug: "abc123def4" })

      expect(response.status).toBe(404)
      expect(response.headers.get("Cache-Control")).toBe("no-store")
    }
  })

  it("creates a cache-resistant 404 for a missing route slug", () => {
    const response = createQrNotFoundResponse()

    expect(response.status).toBe(404)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })
})
