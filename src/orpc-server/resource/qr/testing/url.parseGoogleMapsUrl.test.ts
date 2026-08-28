import { describe, expect, it } from "vite-plus/test"

import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import {
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
