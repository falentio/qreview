import { describe, expect, it } from "vite-plus/test"

import { createRequestContext, getRequestId, withRequestId } from "@/lib/logging"

describe("request logging context", () => {
  it("preserves a safe incoming request ID", () => {
    const request = new Request("https://example.com/r/abc123def4", {
      headers: { "X-Request-ID": "trace-123" },
    })

    expect(getRequestId(request)).toBe("trace-123")
    expect(createRequestContext(request).requestId).toBe("trace-123")
  })

  it("replaces an unsafe incoming request ID", () => {
    const request = new Request("https://example.com/r/abc123def4", {
      headers: { "X-Request-ID": "trace with spaces" },
    })

    const requestId = getRequestId(request)

    expect(requestId).not.toBe("trace with spaces")
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it("adds the request ID without changing the response body or status", async () => {
    const response = withRequestId(new Response("ok", { status: 202 }), "trace-123")

    expect(response.status).toBe(202)
    expect(response.headers.get("X-Request-ID")).toBe("trace-123")
    await expect(response.text()).resolves.toBe("ok")
  })
})
