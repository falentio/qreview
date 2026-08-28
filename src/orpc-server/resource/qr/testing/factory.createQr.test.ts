import { describe, expect, it, vi } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { Database } from "@/db/client"
import { createQr } from "@/orpc-server/resource/qr"
import type { PlacesAdapter } from "@/orpc-server/resource/qr/places"

describe("createQr", () => {
  it("composes the contract resource layers around the injected adapters", async () => {
    const db = mock<Database>()
    const places = mock<PlacesAdapter>()

    const qr = createQr({ db, places })
    const findBySlug = vi.spyOn(qr.repository, "findBySlug").mockResolvedValue(null)

    const response = await qr.publicResponse({ slug: "abc123def4" })

    expect(response.status).toBe(404)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(findBySlug.mock.calls).toEqual([[{ slug: "abc123def4" }]])
  })
})
