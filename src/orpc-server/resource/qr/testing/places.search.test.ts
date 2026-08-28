import { describe, expect, it } from "vite-plus/test"

import { GooglePlacesAdapter } from "@/orpc-server/resource/qr/places"

const placeId = "ChIJ123456789"

function response(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status })
}

describe("GooglePlacesAdapter.search", () => {
  for (const status of [429, 500, 503]) {
    it(`maps HTTP ${status} to service unavailable`, async () => {
      const adapter = new GooglePlacesAdapter({
        apiKey: "test-key",
        fetcher: async () => response(status),
      })

      await expect(adapter.search({ query: "Example" })).rejects.toMatchObject({
        code: "PLACES_UNAVAILABLE",
        httpCode: "SERVICE_UNAVAILABLE",
      })
    })
  }

  it("maps credential configuration failures to service unavailable", async () => {
    const adapter = new GooglePlacesAdapter({ apiKey: " " })

    await expect(adapter.search({ query: "Example" })).rejects.toMatchObject({
      code: "PLACES_UNAVAILABLE",
      httpCode: "SERVICE_UNAVAILABLE",
    })
  })

  it("maps credential HTTP failures to service unavailable", async () => {
    const adapter = new GooglePlacesAdapter({
      apiKey: "test-key",
      fetcher: async () => response(403),
    })

    await expect(adapter.search({ query: "Example" })).rejects.toMatchObject({
      code: "PLACES_UNAVAILABLE",
      httpCode: "SERVICE_UNAVAILABLE",
    })
  })

  it("maps network failures to service unavailable", async () => {
    const adapter = new GooglePlacesAdapter({
      apiKey: "test-key",
      fetcher: () => {
        throw new Error("network down")
      },
    })

    await expect(adapter.search({ query: "Example" })).rejects.toMatchObject({
      code: "PLACES_UNAVAILABLE",
      httpCode: "SERVICE_UNAVAILABLE",
    })
  })

  it("maps invalid requests to place resolution failure", async () => {
    const adapter = new GooglePlacesAdapter({
      apiKey: "test-key",
      fetcher: async () => response(400),
    })

    await expect(adapter.search({ query: "Example" })).rejects.toMatchObject({
      code: "PLACE_RESOLUTION_FAILED",
      httpCode: "BAD_REQUEST",
    })
  })

  it("treats an invalid successful response as a service failure", async () => {
    const adapter = new GooglePlacesAdapter({
      apiKey: "test-key",
      fetcher: async () => new Response("not-json", { status: 200 }),
    })

    await expect(adapter.search({ query: "Example" })).rejects.toMatchObject({
      code: "PLACES_UNAVAILABLE",
      httpCode: "SERVICE_UNAVAILABLE",
    })
  })

  it("returns no more than five valid candidates even when the API over-returns", async () => {
    const adapter = new GooglePlacesAdapter({
      apiKey: "test-key",
      fetcher: async () =>
        response(200, {
          places: Array.from({ length: 6 }, (_, index) => ({
            id: `ChIJ1234567${index}`,
            displayName: { text: `Example location ${index}` },
          })),
        }),
    })

    await expect(adapter.search({ query: "Example" })).resolves.toHaveLength(5)
  })

  it("rejects an overlong search query before making a Places request", async () => {
    let requestCount = 0
    const adapter = new GooglePlacesAdapter({
      apiKey: "test-key",
      fetcher: async () => {
        requestCount += 1
        return response(200, { places: [] })
      },
    })

    await expect(adapter.search({ query: "x".repeat(201) })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    })
    expect(requestCount).toBe(0)
  })

  it("filters candidates with malformed Place IDs", async () => {
    const adapter = new GooglePlacesAdapter({
      apiKey: "test-key",
      fetcher: async () =>
        response(200, {
          places: [
            { id: "not-a-valid-place!", displayName: { text: "Ignored" } },
            { id: placeId, displayName: { text: "Example location" } },
          ],
        }),
    })

    await expect(adapter.search({ query: "Example" })).resolves.toEqual([
      { placeId, name: "Example location", address: null },
    ])
  })
})
