import { env } from "cloudflare:workers"
import { describe, expect, it } from "vite-plus/test"

import { CloudflareKvJsonCache } from "@/orpc-server/resource/qr/cache"
import type { PlaceCandidate, PlacesAdapter } from "@/orpc-server/resource/qr/places"
import { CachedPlacesAdapter } from "@/orpc-server/resource/qr/places-cache"

describe("Places KV cache binding", () => {
  it("stores and serves a search result through the configured KV namespace", async () => {
    const query = `KV binding smoke ${crypto.randomUUID()}`
    const candidate: PlaceCandidate = {
      placeId: "ChIJ123456789",
      name: "Example location",
      address: null,
    }
    let providerCalls = 0
    const places: PlacesAdapter = {
      search: async () => {
        providerCalls += 1
        return [candidate]
      },
      getPlaceDetails: async () => {
        throw new Error("Details are not part of this smoke test.")
      },
    }
    const writes: Promise<unknown>[] = []
    const cache = new CloudflareKvJsonCache({
      namespace: env.PLACES_CACHE,
      waitUntil: (promise) => writes.push(promise),
    })
    const adapter = new CachedPlacesAdapter({ places, cache })

    await expect(adapter.search({ query })).resolves.toEqual([candidate])
    await Promise.all(writes)
    await expect(adapter.search({ query })).resolves.toEqual([candidate])

    expect(providerCalls).toBe(1)
  })
})
