import { describe, expect, it } from "vite-plus/test"

import {
  createGoogleCanonicalReviewUrl,
  googleFeatureIdFromPlaceId,
  googlePlaceIdFromFeatureId,
  MAX_GOOGLE_MAPS_QUERY_LENGTH,
  MAX_GOOGLE_MAPS_URL_LENGTH,
  parseGoogleMapsUrl,
  resolveGoogleMapsUrl,
} from "@/orpc-server/resource/qr/url"

const featureId = "0x2e7887b579f3d48f:0x6ec81fc2711b27a"
const placeId = "ChIJj9TzebWHeC4RerIRJ_yB7AY"

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
      featureId: null,
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
      featureId: null,
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
      featureId: null,
      query: "Example",
    })
    expect(parseGoogleMapsUrl("https://maps.google.com/maps/place/ChIJ123456789/details")).toEqual({
      rawUrl: "https://maps.google.com/maps/place/ChIJ123456789/details",
      placeId: "ChIJ123456789",
      featureId: null,
      query: null,
    })
    expect(
      parseGoogleMapsUrl(
        "https://www.google.com/maps/place/Hadar+Kopi+%26+Jamu/@-7.8840559,112.5184512,17z/data=!3m1!4b1!4m6!3m5!1s0x2e78872eb95f61c3:0x524dc00ed3a1a6ec!8m2!3d-7.8840559!4d112.5184512!16s%2Fg%2F11stf9xb64",
      ),
    ).toEqual({
      rawUrl:
        "https://www.google.com/maps/place/Hadar+Kopi+%26+Jamu/@-7.8840559,112.5184512,17z/data=!3m1!4b1!4m6!3m5!1s0x2e78872eb95f61c3:0x524dc00ed3a1a6ec!8m2!3d-7.8840559!4d112.5184512!16s%2Fg%2F11stf9xb64",
      placeId: "ChIJw2FfuS6HeC4R7Kah0w7ATVI",
      featureId: "0x2e78872eb95f61c3:0x524dc00ed3a1a6ec",
      query: "Hadar Kopi & Jamu",
    })
    expect(
      parseGoogleMapsUrl("https://www.google.com/maps/search/?q=%20Example%20Cafe%20"),
    ).toEqual({
      rawUrl: "https://www.google.com/maps/search/?q=%20Example%20Cafe%20",
      placeId: null,
      featureId: null,
      query: "Example Cafe",
    })
    expect(
      parseGoogleMapsUrl("https://www.google.com/maps/place/Example+Cafe/@40.1,-73.2,17z"),
    ).toEqual({
      rawUrl: "https://www.google.com/maps/place/Example+Cafe/@40.1,-73.2,17z",
      placeId: null,
      featureId: null,
      query: "Example Cafe",
    })
  })

  it("converts a Maps feature ID into the reported Place ID", () => {
    expect(
      parseGoogleMapsUrl(
        "https://www.google.com/maps/place/Example/data=!4m2!3m1!1s0x2e7887b579f3d48f:0x6ec81fc2711b27a!12e1",
      ),
    ).toEqual({
      rawUrl:
        "https://www.google.com/maps/place/Example/data=!4m2!3m1!1s0x2e7887b579f3d48f:0x6ec81fc2711b27a!12e1",
      placeId,
      featureId,
      query: "Example",
    })
    expect(googlePlaceIdFromFeatureId(featureId)).toBe(placeId)
    expect(googleFeatureIdFromPlaceId(placeId)).toBe(featureId)
    expect(createGoogleCanonicalReviewUrl({ placeId, featureId })).toBe(
      "https://www.google.com/maps/place//data=!4m3!3m2!1s0x2e7887b579f3d48f:0x6ec81fc2711b27a!12e1",
    )
  })

  it("rejects inconsistent textual and feature IDs", () => {
    expect(() =>
      parseGoogleMapsUrl(
        "https://www.google.com/maps/place/Example/data=!1sChIJj9TzebWHeC4RerIRJ_yB7AY!1s0x808f778c55555555:0xa4f25c571acded3f!12e1",
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_GOOGLE_MAPS_URL" }))
  })

  it("does not extract feature IDs from unrelated query parameters", () => {
    expect(
      parseGoogleMapsUrl(
        "https://www.google.com/maps/search/?query=Example&tracking=!1s0x2e7887b579f3d48f:0x6ec81fc2711b27a!12e1",
      ),
    ).toEqual({
      rawUrl:
        "https://www.google.com/maps/search/?query=Example&tracking=!1s0x2e7887b579f3d48f:0x6ec81fc2711b27a!12e1",
      placeId: null,
      featureId: null,
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
  it("parses direct Maps URLs without invoking the resolver", async () => {
    const resolve = async () => {
      throw new Error("resolver should not be called")
    }

    await expect(
      resolveGoogleMapsUrl("  https://www.google.com/maps/search/?query=Example  ", { resolve }),
    ).resolves.toEqual({
      rawUrl: "https://www.google.com/maps/search/?query=Example",
      placeId: null,
      featureId: null,
      query: "Example",
    })
  })

  it("uses the resolver for short URLs and preserves the original URL", async () => {
    const shortUrl = "https://maps.app.goo.gl/z8eTy4rJq16zpAgP6"
    const redirectedUrl =
      "https://www.google.com/maps/place/Example/data=!4m2!3m1!1s0x2e7887b579f3d48f:0x6ec81fc2711b27a!12e1"
    const resolve = async (value: string) => {
      expect(value).toBe(shortUrl)
      return redirectedUrl
    }

    await expect(resolveGoogleMapsUrl(shortUrl, { resolve })).resolves.toEqual({
      rawUrl: shortUrl,
      placeId,
      featureId,
      query: "Example",
    })
  })

  it("wraps resolver failures as place resolution failures", async () => {
    await expect(
      resolveGoogleMapsUrl("https://maps.app.goo.gl/z8eTy4rJq16zpAgP6", {
        resolve: async () => {
          throw new Error("provider unavailable")
        },
      }),
    ).rejects.toMatchObject({ code: "PLACE_RESOLUTION_FAILED" })
  })

  it("rejects malformed final URLs from the resolver", async () => {
    await expect(
      resolveGoogleMapsUrl("https://maps.app.goo.gl/z8eTy4rJq16zpAgP6", {
        resolve: async () => "https://example.com/private",
      }),
    ).rejects.toMatchObject({ code: "PLACE_RESOLUTION_FAILED" })
  })
})
