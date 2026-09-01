import { describe, expect, it, vi } from "vite-plus/test"

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

  it("logs the upstream reason before mapping a rejected request", async () => {
    const warn = vi.fn()
    const adapter = new GooglePlacesAdapter({
      apiKey: "test-key",
      logger: { warn },
      fetcher: async () =>
        response(400, {
          error: {
            code: 400,
            status: "INVALID_ARGUMENT",
            message: "Request contains an invalid argument.",
          },
        }),
    })

    await expect(adapter.search({ query: "Example" })).rejects.toMatchObject({
      code: "PLACE_RESOLUTION_FAILED",
      httpCode: "BAD_REQUEST",
    })
    expect(warn).toHaveBeenCalledWith(
      "Google Places request failed.",
      expect.objectContaining({
        event: "google_places.request_failed",
        operation: "searchText",
        httpStatus: 400,
        googleCode: 400,
        googleStatus: "INVALID_ARGUMENT",
        googleMessage: "Request contains an invalid argument.",
      }),
    )
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
    let requestInput: RequestInfo | URL | undefined
    let requestInit: RequestInit | undefined
    const adapter = new GooglePlacesAdapter({
      apiKey: "test-key",
      fetcher: async (input, init) => {
        requestInput = input
        requestInit = init
        return response(200, {
          places: Array.from({ length: 6 }, (_, index) => ({
            id: `ChIJ1234567${index}`,
            displayName: { text: `Example location ${index}` },
          })),
        })
      },
    })

    await expect(adapter.search({ query: " Example " })).resolves.toEqual([
      { placeId: "ChIJ12345670", name: "Example location 0", address: null },
      { placeId: "ChIJ12345671", name: "Example location 1", address: null },
      { placeId: "ChIJ12345672", name: "Example location 2", address: null },
      { placeId: "ChIJ12345673", name: "Example location 3", address: null },
      { placeId: "ChIJ12345674", name: "Example location 4", address: null },
    ])
    expect(requestInput).toBe("https://places.googleapis.com/v1/places:searchText")
    expect(requestInit).toEqual({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": "test-key",
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
      },
      body: JSON.stringify({ textQuery: "Example", maxResultCount: 5 }),
    })
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

  it("rejects blank queries before making a Places request", async () => {
    let requestCount = 0
    const adapter = new GooglePlacesAdapter({
      apiKey: "test-key",
      fetcher: async () => {
        requestCount += 1
        return response(200, { places: [] })
      },
    })

    await expect(adapter.search({ query: "   " })).rejects.toMatchObject({
      code: "INVALID_INPUT",
      httpCode: "BAD_REQUEST",
    })
    expect(requestCount).toBe(0)
  })
})
