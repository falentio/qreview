import { describe, expect, it } from "vite-plus/test"

import { getSlugFromQrValue } from "@/lib/qr-code"

describe("getSlugFromQrValue", () => {
  it("extracts a slug from QR content or an app URL", () => {
    expect(getSlugFromQrValue("abc123def4")).toBe("abc123def4")
    expect(getSlugFromQrValue(" https://example.com/r/abc123def4/ ")).toBe("abc123def4")
  })

  it("rejects content that is not an app QR slug", () => {
    expect(getSlugFromQrValue("abc123def")).toBeNull()
    expect(getSlugFromQrValue("https://example.com/other/abc123def4")).toBeNull()
    expect(getSlugFromQrValue("javascript:alert(1)")).toBeNull()
  })
})
