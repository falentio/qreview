import { describe, expect, it } from "vite-plus/test"

import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import { parseGoogleMapsUrl } from "@/orpc-server/resource/qr/url"

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
    ]) {
      expect(() => parseGoogleMapsUrl(value)).toThrow(QrDomainError)
    }
  })
})
