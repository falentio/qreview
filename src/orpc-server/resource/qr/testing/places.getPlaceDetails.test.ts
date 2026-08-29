import { describe, expect, it } from "vite-plus/test"

import { GooglePlacesAdapter } from "@/orpc-server/resource/qr/places"

const placeId = "ChIJ123456789"

function response(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status })
}

describe("GooglePlacesAdapter.getPlaceDetails", () => {
  it("returns confirmed place details and requests the expected fields", async () => {
    let requestInput: RequestInfo | URL | undefined
    let requestInit: RequestInit | undefined
    const adapter = new GooglePlacesAdapter({
      apiKey: "test-key",
      fetcher: async (input, init) => {
        requestInput = input
        requestInit = init
        return response(200, {
          id: placeId,
          displayName: { text: "Example location" },
          formattedAddress: "1 Example Street",
          googleMapsLinks: {
            writeAReviewUri: `https://search.google.com/local/writereview?placeid=${placeId}`,
          },
        })
      },
    })

    await expect(adapter.getPlaceDetails({ placeId })).resolves.toEqual({
      placeId,
      name: "Example location",
      address: "1 Example Street",
      canonicalReviewUrl: `https://search.google.com/local/writereview?placeid=${placeId}`,
    })
    expect(requestInput).toBe(`https://places.googleapis.com/v1/places/${placeId}`)
    expect(requestInit).toEqual({
      method: "GET",
      headers: {
        "X-Goog-Api-Key": "test-key",
        "X-Goog-FieldMask": "id,displayName,formattedAddress,googleMapsLinks.writeAReviewUri",
      },
    })
  })

  it("accepts the Maps review URL returned for a real place", async () => {
    const reportedPlaceId = "ChIJw2FfuS6HeC4R7Kah0w7ATVI"
    const mapsReviewUrl =
      "https://www.google.com/maps/place//data=!4m3!3m2!1s0x2e78872eb95f61c3:0x524dc00ed3a1a6ec!12e1?g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA"
    const adapter = new GooglePlacesAdapter({
      apiKey: "test-key",
      fetcher: async () =>
        response(200, {
          id: reportedPlaceId,
          displayName: { text: "Reported location" },
          googleMapsLinks: { writeAReviewUri: mapsReviewUrl },
        }),
    })

    await expect(adapter.getPlaceDetails({ placeId: reportedPlaceId })).resolves.toMatchObject({
      placeId: reportedPlaceId,
      canonicalReviewUrl: mapsReviewUrl,
    })
  })

  it("rejects an invalid Place ID before making a request", async () => {
    let requestCount = 0
    const adapter = new GooglePlacesAdapter({
      apiKey: "test-key",
      fetcher: async () => {
        requestCount += 1
        return response(200)
      },
    })

    await expect(adapter.getPlaceDetails({ placeId: "invalid" })).rejects.toMatchObject({
      code: "PLACE_RESOLUTION_FAILED",
      httpCode: "BAD_REQUEST",
    })
    expect(requestCount).toBe(0)
  })

  it("maps HTTP and malformed responses to domain errors", async () => {
    for (const [status, code, httpCode] of [
      [400, "PLACE_RESOLUTION_FAILED", "BAD_REQUEST"],
      [500, "PLACES_UNAVAILABLE", "SERVICE_UNAVAILABLE"],
    ] as const) {
      const adapter = new GooglePlacesAdapter({
        apiKey: "test-key",
        fetcher: async () => response(status),
      })

      await expect(adapter.getPlaceDetails({ placeId })).rejects.toMatchObject({ code, httpCode })
    }

    const adapter = new GooglePlacesAdapter({
      apiKey: "test-key",
      fetcher: async () => new Response("not-json", { status: 200 }),
    })

    await expect(adapter.getPlaceDetails({ placeId })).rejects.toMatchObject({
      code: "PLACES_UNAVAILABLE",
      httpCode: "SERVICE_UNAVAILABLE",
    })
  })

  it("rejects a canonical review URL for a different Place ID", async () => {
    const adapter = new GooglePlacesAdapter({
      apiKey: "test-key",
      fetcher: async () =>
        response(200, {
          id: placeId,
          displayName: { text: "Example location" },
          googleMapsLinks: {
            writeAReviewUri: "https://search.google.com/local/writereview?placeid=ChIJ987654321",
          },
        }),
    })

    await expect(adapter.getPlaceDetails({ placeId })).rejects.toMatchObject({
      code: "PLACE_RESOLUTION_FAILED",
      httpCode: "BAD_REQUEST",
    })
  })
})
