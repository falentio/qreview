import { describe, expect, it } from "vite-plus/test"

import { isGoogleCanonicalReviewUrlForPlace } from "@/orpc-server/resource/qr/url"

const placeId = "ChIJj9TzebWHeC4RerIRJ_yB7AY"
const canonicalReviewUrl =
  "https://www.google.com/maps/place//data=!4m3!3m2!1s0x2e7887b579f3d48f:0x6ec81fc2711b27a!12e1"

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
    expect(isGoogleCanonicalReviewUrlForPlace(canonicalReviewUrl, placeId)).toBe(true)
    expect(isGoogleCanonicalReviewUrlForPlace(canonicalReviewUrl, "ChIJ987654321")).toBe(false)
    expect(
      isGoogleCanonicalReviewUrlForPlace(
        "https://search.google.com/local/writereview?placeid=ChIJ123456789&hl=en",
        "ChIJ123456789",
      ),
    ).toBe(false)
  })
})
