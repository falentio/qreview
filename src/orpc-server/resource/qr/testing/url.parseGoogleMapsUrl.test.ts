import { describe, expect, it } from "vite-plus/test"

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

  it("extracts supported place ID and query forms", () => {
    expect(
      parseGoogleMapsUrl(
        "https://www.google.com/maps/search/?api=1&query=Example&place_id=ChIJ123456789",
      ),
    ).toEqual({
      rawUrl: "https://www.google.com/maps/search/?api=1&query=Example&place_id=ChIJ123456789",
      placeId: "ChIJ123456789",
      query: "Example",
    })
    expect(
      parseGoogleMapsUrl(
        "https://www.google.com/maps/search/?api=1&query=Example&data=!4m2!1sChIJ123456789!2sExample",
      ),
    ).toEqual({
      rawUrl:
        "https://www.google.com/maps/search/?api=1&query=Example&data=!4m2!1sChIJ123456789!2sExample",
      placeId: "ChIJ123456789",
      query: "Example",
    })
    expect(parseGoogleMapsUrl("https://maps.google.com/maps/place/ChIJ123456789/details")).toEqual({
      rawUrl: "https://maps.google.com/maps/place/ChIJ123456789/details",
      placeId: "ChIJ123456789",
      query: null,
    })
    expect(
      parseGoogleMapsUrl("https://www.google.com/maps/search/?q=%20Example%20Cafe%20"),
    ).toEqual({
      rawUrl: "https://www.google.com/maps/search/?q=%20Example%20Cafe%20",
      placeId: null,
      query: "Example Cafe",
    })
    expect(
      parseGoogleMapsUrl("https://www.google.com/maps/place/Example+Cafe/@40.1,-73.2,17z"),
    ).toEqual({
      rawUrl: "https://www.google.com/maps/place/Example+Cafe/@40.1,-73.2,17z",
      placeId: null,
      query: "Example Cafe",
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
      expect(() => parseGoogleMapsUrl(value)).toThrowError(
        expect.objectContaining({
          code: "INVALID_GOOGLE_MAPS_URL",
        }),
      )
    }
  })

  it("rejects oversized URLs and place queries", () => {
    expect(() =>
      parseGoogleMapsUrl(
        `https://www.google.com/maps/search/?query=${"x".repeat(MAX_GOOGLE_MAPS_URL_LENGTH)}`,
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_GOOGLE_MAPS_URL" }))
    expect(() =>
      parseGoogleMapsUrl(
        `https://www.google.com/maps/search/?query=${"x".repeat(MAX_GOOGLE_MAPS_QUERY_LENGTH + 1)}`,
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_GOOGLE_MAPS_URL" }))
  })

  it("rejects malformed URLs and URLs without a place", () => {
    for (const value of [
      "not-a-url",
      "https://www.google.com/maps/search/",
      "https://www.google.com/maps/%E0%A4%A",
    ]) {
      expect(() => parseGoogleMapsUrl(value)).toThrowError(
        expect.objectContaining({
          code: "INVALID_GOOGLE_MAPS_URL",
        }),
      )
    }
  })
})
