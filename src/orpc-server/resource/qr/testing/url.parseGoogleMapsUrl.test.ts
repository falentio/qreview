import { describe, expect, it, vi } from "vite-plus/test"

import {
  MAX_GOOGLE_MAPS_QUERY_LENGTH,
  MAX_GOOGLE_MAPS_URL_LENGTH,
  parseGoogleMapsUrl,
  resolveGoogleMapsUrl,
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
      parseGoogleMapsUrl(
        "https://www.google.com/maps/place/Hadar+Kopi+%26+Jamu/@-7.8840559,112.5184512,17z/data=!3m1!4b1!4m6!3m5!1s0x2e78872eb95f61c3:0x524dc00ed3a1a6ec!8m2!3d-7.8840559!4d112.5184512!16s%2Fg%2F11stf9xb64",
      ),
    ).toEqual({
      rawUrl:
        "https://www.google.com/maps/place/Hadar+Kopi+%26+Jamu/@-7.8840559,112.5184512,17z/data=!3m1!4b1!4m6!3m5!1s0x2e78872eb95f61c3:0x524dc00ed3a1a6ec!8m2!3d-7.8840559!4d112.5184512!16s%2Fg%2F11stf9xb64",
      placeId: null,
      query: "Hadar Kopi & Jamu",
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

describe("resolveGoogleMapsUrl", () => {
  it("logs short-link response diagnostics before returning a bad request", async () => {
    const warn = vi.fn()
    const shortUrl = "https://maps.app.goo.gl/z8eTy4rJq16zpAgP6"

    await expect(
      resolveGoogleMapsUrl(shortUrl, async () => new Response(null, { status: 400 }), { warn }),
    ).rejects.toMatchObject({
      code: "PLACE_RESOLUTION_FAILED",
      httpCode: "BAD_REQUEST",
    })

    expect(warn).toHaveBeenCalledWith(
      "Google Maps short URL could not be processed.",
      expect.objectContaining({
        event: "google_maps.short_url_resolution_failed",
        httpStatus: 400,
        responseUrlPresent: false,
        responseUrlMatchesInput: false,
      }),
    )
  })
})
