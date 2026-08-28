import { describe, expect, it } from "vite-plus/test"

import { isGoogleCanonicalReviewUrl } from "@/orpc-server/resource/qr/url"

describe("isGoogleCanonicalReviewUrl", () => {
  it("accepts the supported Google review URL forms", () => {
    expect(
      isGoogleCanonicalReviewUrl(
        "https://search.google.com/local/writereview?placeid=ChIJ123456789",
      ),
    ).toBe(true)
    expect(
      isGoogleCanonicalReviewUrl(
        "https://www.google.com/maps/place//data=!4m3!3m2!1s0x808f778c55555555:0xa4f25c571acded3f!12e1",
      ),
    ).toBe(true)
  })

  it("rejects Google URLs that are not supported review links", () => {
    for (const value of [
      "https://evil.google.com/not-a-review",
      "https://www.google.com/maps/place/Example",
      "https://search.google.com/local/writereview?placeid=ChIJ123456789&hl=en",
    ]) {
      expect(isGoogleCanonicalReviewUrl(value)).toBe(false)
    }
  })
})
