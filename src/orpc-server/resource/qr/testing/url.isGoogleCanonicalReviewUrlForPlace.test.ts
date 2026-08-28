import { describe, expect, it } from "vite-plus/test"

import { isGoogleCanonicalReviewUrlForPlace } from "@/orpc-server/resource/qr/url"

describe("isGoogleCanonicalReviewUrlForPlace", () => {
  it("requires the place ID on review URLs that carry one", () => {
    expect(
      isGoogleCanonicalReviewUrlForPlace(
        "https://search.google.com/local/writereview?placeid=ChIJ123456789",
        "ChIJ123456789",
      ),
    ).toBe(true)
    expect(
      isGoogleCanonicalReviewUrlForPlace(
        "https://search.google.com/local/writereview?placeid=ChIJ123456789",
        "ChIJ987654321",
      ),
    ).toBe(false)
  })

  it("keeps the other strict Google review URL form allowlisted", () => {
    expect(
      isGoogleCanonicalReviewUrlForPlace(
        "https://www.google.com/maps/place//data=!4m3!3m2!1s0x808f778c55555555:0xa4f25c571acded3f!12e1",
        "ChIJ123456789",
      ),
    ).toBe(true)
    expect(
      isGoogleCanonicalReviewUrlForPlace(
        "https://search.google.com/local/writereview?placeid=ChIJ123456789&hl=en",
        "ChIJ123456789",
      ),
    ).toBe(false)
  })
})
