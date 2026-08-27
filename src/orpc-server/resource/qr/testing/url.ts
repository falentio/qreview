import { describe, expect, it } from "vite-plus/test"

import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import {
  isGoogleCanonicalReviewUrl,
  isGoogleCanonicalReviewUrlForPlace,
  MAX_GOOGLE_MAPS_QUERY_LENGTH,
  MAX_GOOGLE_MAPS_URL_LENGTH,
  parseGoogleMapsUrl,
} from "@/orpc-server/resource/qr/url"

describe("parseGoogleMapsUrl", () => {
  it("accepts supported HTTPS Google Maps URLs and extracts a place ID", () => {
    expect(
      parseGoogleMapsUrl(
        "https://www.google.com/maps/search/?api=1&query=Example&query_place_id=ChIJ123456789",
      ),
    ).toEqual({
      rawUrl:
        "https://www.google.com/maps/search/?api=1&query=Example&query_place_id=ChIJ123456789",
      placeId: "ChIJ123456789",
      query: "Example",
    })
  })

  it("rejects non-HTTPS and non-Google Maps hosts", () => {
    for (const value of [
      "http://www.google.com/maps/search/?query=Example",
      "https://example.com/maps/search/?query=Example",
      "https://www.google.com/search?q=Example",
      "https://maps.app.goo.gl/example",
      "https://maps.google.com/?cid=11885663895765773631",
    ]) {
      expect(() => parseGoogleMapsUrl(value)).toThrow(QrDomainError)
    }
  })

  it("rejects oversized URLs and place queries", () => {
    expect(() =>
      parseGoogleMapsUrl(
        `https://www.google.com/maps/search/?query=${"x".repeat(MAX_GOOGLE_MAPS_URL_LENGTH)}`,
      ),
    ).toThrow(QrDomainError)
    expect(() =>
      parseGoogleMapsUrl(
        `https://www.google.com/maps/search/?query=${"x".repeat(MAX_GOOGLE_MAPS_QUERY_LENGTH + 1)}`,
      ),
    ).toThrow(QrDomainError)
  })
})

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
