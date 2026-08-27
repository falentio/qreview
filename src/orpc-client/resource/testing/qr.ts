import { describe, expect, it } from "vite-plus/test"

import { createQrClient } from "@/orpc-client/resource/qr"
import type { ApiContract } from "@/orpc-contract"
import type { ContractRouterClient } from "@orpc/contract"

describe("createQrClient", () => {
  it("exposes the QR branch of the contract client", () => {
    const qr = {}
    const client = { qr } as ContractRouterClient<ApiContract>

    expect(createQrClient(client)).toBe(qr)
  })
})
