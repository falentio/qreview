import { describe, expect, it } from "vite-plus/test"

import { GooglePlacesAdapter } from "@/orpc-server/resource/qr/places"

const placeId = "ChIJ123456789"

function response(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status })
}

describe("GooglePlacesAdapter.getPlaceDetails", () => {
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
