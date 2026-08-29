import { env } from "cloudflare:workers"
import { describe, expect, it } from "vite-plus/test"

import { GooglePlacesAdapter } from "@/orpc-server/resource/qr/places"

const apiKey = env.GOOGLE_MAPS_API_KEY?.trim() ?? ""

describe.skipIf(!apiKey)("Google Places API", () => {
  it("searches for a place", async () => {
    const adapter = new GooglePlacesAdapter({ apiKey })
    const candidates = await adapter.search({ query: "Eiffel Tower, Paris" })
    const candidate = candidates[0]

    expect(candidate).toBeDefined()
    expect(candidate?.placeId).toMatch(/^ChI/)
    expect(candidate?.name).toBeTruthy()
  }, 30_000)
})
