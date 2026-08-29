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

  it("retrieves the reported place details", async () => {
    const adapter = new GooglePlacesAdapter({ apiKey })
    const details = await adapter.getPlaceDetails({
      placeId: "ChIJw2FfuS6HeC4R7Kah0w7ATVI",
    })

    expect(details).toMatchObject({
      placeId: "ChIJw2FfuS6HeC4R7Kah0w7ATVI",
      canonicalReviewUrl: expect.stringMatching(
        /^https:\/\/www\.google\.com\/maps\/place\/\/data=/,
      ),
    })
  }, 30_000)
})
