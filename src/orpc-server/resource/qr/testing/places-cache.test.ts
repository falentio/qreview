import { describe, expect, it, vi } from "vite-plus/test"

import { CloudflareKvJsonCache, type KvStore } from "@/orpc-server/resource/qr/cache"
import { CachedPlacesAdapter } from "@/orpc-server/resource/qr/places-cache"
import type { PlaceDetails, PlaceCandidate, PlacesAdapter } from "@/orpc-server/resource/qr/places"

const candidate: PlaceCandidate = {
  placeId: "ChIJ123456789",
  name: "Example location",
  address: "1 Example Street",
}

const details: PlaceDetails = {
  ...candidate,
  canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ123456789",
}

function createNamespace(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues))
  const namespace = {
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      values.set(key, value)
    }),
  } as unknown as KvStore
  return { namespace, values }
}

function setup({ initialValues = {} }: { initialValues?: Record<string, string> } = {}) {
  const { namespace, values } = createNamespace(initialValues)
  const search = vi.fn(
    async (_input: Parameters<PlacesAdapter["search"]>[0]): Promise<PlaceCandidate[]> => [
      candidate,
    ],
  )
  const getPlaceDetails = vi.fn(
    async (_input: Parameters<PlacesAdapter["getPlaceDetails"]>[0]): Promise<PlaceDetails> =>
      details,
  )
  const places = { search, getPlaceDetails }
  const writes: Promise<unknown>[] = []
  const cache = new CloudflareKvJsonCache({
    namespace,
    waitUntil: (promise) => writes.push(promise),
  })
  const adapter = new CachedPlacesAdapter({ places, cache })

  return { adapter, places, values, writes }
}

async function flush(writes: Promise<unknown>[]) {
  await Promise.all(writes.splice(0))
}

describe("CachedPlacesAdapter", () => {
  it("serves a cached search result without calling Places again", async () => {
    const { adapter, places, writes } = setup()

    await expect(adapter.search({ query: " Example " })).resolves.toEqual([candidate])
    await flush(writes)
    await expect(adapter.search({ query: "Example" })).resolves.toEqual([candidate])

    expect(places.search).toHaveBeenCalledTimes(1)
    expect(places.search).toHaveBeenCalledWith({ query: "Example" })
  })

  it("does not cache an empty search result", async () => {
    const { adapter, places, writes } = setup()
    places.search.mockResolvedValue([])

    await expect(adapter.search({ query: "Unknown" })).resolves.toEqual([])
    await flush(writes)
    await expect(adapter.search({ query: "Unknown" })).resolves.toEqual([])

    expect(places.search).toHaveBeenCalledTimes(2)
    expect(writes).toHaveLength(0)
  })

  it("serves cached place details without calling Places again", async () => {
    const { adapter, places, writes } = setup()

    await expect(adapter.getPlaceDetails({ placeId: details.placeId })).resolves.toEqual(details)
    await flush(writes)
    await expect(adapter.getPlaceDetails({ placeId: details.placeId })).resolves.toEqual(details)

    expect(places.getPlaceDetails).toHaveBeenCalledTimes(1)
  })

  it("refetches when a cached domain value is invalid", async () => {
    const { adapter, places, values, writes } = setup({
      initialValues: {
        "places:v1:details:ChIJ123456789": JSON.stringify({
          placeId: "ChIJ123456789",
          canonicalReviewUrl: "not-a-review-url",
        }),
      },
    })

    await expect(adapter.getPlaceDetails({ placeId: details.placeId })).resolves.toEqual(details)
    await flush(writes)

    expect(places.getPlaceDetails).toHaveBeenCalledTimes(1)
    expect(values.get("places:v1:details:ChIJ123456789")).toBe(JSON.stringify(details))
  })

  it("rejects invalid search queries before reading or writing the cache", async () => {
    const { adapter, places, values, writes } = setup()

    await expect(adapter.search({ query: "   " })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    })
    await flush(writes)

    expect(places.search).not.toHaveBeenCalled()
    expect(values.size).toBe(0)
  })
})
