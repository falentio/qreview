import { describe, expect, it, vi } from "vite-plus/test"

import {
  createRapidApiRedirectResolver,
  RedirectProxyError,
} from "@/orpc-server/resource/qr/redirect-resolver"

const shortUrl = "https://maps.app.goo.gl/YbcXdSF99Zddsejh9"
const finalUrl = "https://www.google.com/maps/place/Hadar+Kopi+%26+Jamu"

function createResolver(fetcher: typeof fetch = fetch) {
  return createRapidApiRedirectResolver({
    apiKey: "test-api-key",
    fetcher,
  })
}

describe("RapidAPI redirect resolver", () => {
  it("returns the final URL from the redirect-checker response", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ link: shortUrl, http_code: 302, final_url: finalUrl }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    )
    const resolver = createResolver(fetcher)

    await expect(resolver.resolve(shortUrl)).resolves.toBe(finalUrl)
    expect(fetcher).toHaveBeenCalledWith(
      `https://seo-api2.p.rapidapi.com/redirect-checker?url=${encodeURIComponent(shortUrl)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-rapidapi-host": "seo-api2.p.rapidapi.com",
          "x-rapidapi-key": "test-api-key",
        },
      },
    )
  })

  it("rejects a provider response without a final URL", async () => {
    const resolver = createResolver(
      async () => new Response(JSON.stringify({ link: shortUrl, http_code: 302 }), { status: 200 }),
    )

    await expect(resolver.resolve(shortUrl)).rejects.toBeInstanceOf(RedirectProxyError)
  })

  it("rejects an unavailable provider", async () => {
    const resolver = createResolver(async () => new Response(null, { status: 429 }))

    await expect(resolver.resolve(shortUrl)).rejects.toBeInstanceOf(RedirectProxyError)
  })
})
