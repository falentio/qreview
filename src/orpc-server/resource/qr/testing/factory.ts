import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { Database } from "@/db/client"
import { createQr } from "@/orpc-server/resource/qr"
import { QrRepository } from "@/orpc-server/resource/qr/repository"
import type { PlacesAdapter } from "@/orpc-server/resource/qr/places"
import { QrService } from "@/orpc-server/resource/qr/service"

describe("createQr", () => {
  it("composes the contract resource layers around the injected adapters", () => {
    const db = mock<Database>()
    const places = mock<PlacesAdapter>()

    const qr = createQr({ db, places })

    expect(qr.repository).toBeInstanceOf(QrRepository)
    expect(qr.service).toBeInstanceOf(QrService)
    expect(qr.router.resolve).toBeDefined()
    expect(qr.router.createOrphan).toBeDefined()
    expect(qr.router.claim).toBeDefined()
    expect(qr.router.restore).toBeDefined()
  })
})
