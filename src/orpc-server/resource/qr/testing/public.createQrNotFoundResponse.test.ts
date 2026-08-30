import { describe, expect, it } from "vite-plus/test"

import { createQrExpiredResponse, createQrNotFoundResponse } from "@/orpc-server/resource/qr/public"

describe("createQrNotFoundResponse", () => {
  it("creates a cache-resistant 404", () => {
    const response = createQrNotFoundResponse()

    expect(response.status).toBe(404)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })
})

describe("createQrExpiredResponse", () => {
  it("creates a cache-resistant 410", () => {
    const response = createQrExpiredResponse()

    expect(response.status).toBe(410)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })
})
