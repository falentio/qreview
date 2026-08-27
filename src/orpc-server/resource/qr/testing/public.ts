import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { QrService } from "@/orpc-server/resource/qr/service"
import { createQrPublicResponse } from "@/orpc-server/resource/qr/public"
import { QrDomainError } from "@/orpc-server/resource/qr/errors"

describe("createQrPublicResponse", () => {
  it("redirects active QR codes without allowing the redirect to be cached", async () => {
    const service = mock<QrService>()
    service.resolvePublic.mockResolvedValue({
      kind: "redirect",
      canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ123456789",
    })

    const response = await createQrPublicResponse({ service, slug: "abc123def4" })

    expect(response.status).toBe(307)
    expect(response.headers.get("Location")).toBe(
      "https://search.google.com/local/writereview?placeid=ChIJ123456789",
    )
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })

  it("returns a neutral setup response for orphan or incomplete QR codes", async () => {
    const service = mock<QrService>()
    service.resolvePublic.mockResolvedValue({ kind: "setup" })

    const response = await createQrPublicResponse({ service, slug: "abc123def4" })

    expect(response.status).toBe(200)
    expect(await response.text()).toContain("not configured")
  })

  it("returns 404 for archived or missing QR codes", async () => {
    const service = mock<QrService>()
    service.resolvePublic.mockRejectedValue(new QrDomainError("NOT_FOUND", "Missing"))

    const response = await createQrPublicResponse({ service, slug: "abc123def4" })

    expect(response.status).toBe(404)
  })
})
