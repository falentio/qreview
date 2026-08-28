import { describe, expect, it } from "vite-plus/test"

import { createQrNotFoundResponse } from "@/orpc-server/resource/qr/public"

describe("createQrNotFoundResponse", () => {
  it("creates a cache-resistant 404", () => {
    const response = createQrNotFoundResponse()

    expect(response.status).toBe(404)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })
})
