import { describe, expect, it, vi } from "vite-plus/test"

import { CloudflareKvJsonCache, type KvStore } from "@/orpc-server/resource/qr/cache"

function createNamespace({
  value = null,
  getError,
  putError,
}: {
  value?: string | null
  getError?: Error
  putError?: Error
} = {}) {
  const get = vi.fn(async () => {
    if (getError) throw getError
    return value
  })
  const put = vi.fn(async () => {
    if (putError) throw putError
  })
  const namespace = { get, put } as unknown as KvStore
  return { namespace, get, put }
}

describe("CloudflareKvJsonCache", () => {
  it("returns decoded JSON values from KV", async () => {
    const { namespace, get } = createNamespace({ value: JSON.stringify({ enabled: true }) })
    const cache = new CloudflareKvJsonCache({ namespace, waitUntil: () => undefined })

    await expect(cache.get({ key: "places:v1:search:abc", kind: "search" })).resolves.toEqual({
      enabled: true,
    })
    expect(get).toHaveBeenCalledWith("places:v1:search:abc", "text")
  })

  it("treats missing and malformed values as cache misses", async () => {
    const warn = vi.fn()
    const { namespace } = createNamespace({ value: "not-json" })
    const cache = new CloudflareKvJsonCache({
      namespace,
      waitUntil: () => undefined,
      logger: { warn },
    })

    await expect(
      cache.get({ key: "places:v1:details:ChIJ123456789", kind: "details" }),
    ).resolves.toBe(null)
    expect(warn).toHaveBeenCalledWith("Places cache read failed.", {
      kind: "details",
      error: expect.any(SyntaxError),
    })

    const missing = new CloudflareKvJsonCache({
      namespace: createNamespace().namespace,
      waitUntil: () => undefined,
    })
    await expect(missing.get({ key: "missing", kind: "search" })).resolves.toBe(null)
  })

  it("treats KV read failures as cache misses", async () => {
    const warn = vi.fn()
    const cache = new CloudflareKvJsonCache({
      namespace: createNamespace({ getError: new Error("KV unavailable") }).namespace,
      waitUntil: () => undefined,
      logger: { warn },
    })

    await expect(cache.get({ key: "places:v1:search:abc", kind: "search" })).resolves.toBe(null)
    expect(warn).toHaveBeenCalledWith("Places cache read failed.", {
      kind: "search",
      error: expect.any(Error),
    })
  })

  it("schedules a JSON write with a 30-day TTL", async () => {
    const { namespace, put } = createNamespace()
    const writes: Promise<unknown>[] = []
    const cache = new CloudflareKvJsonCache({
      namespace,
      waitUntil: (promise) => writes.push(promise),
    })

    cache.set({
      key: "places:v1:details:ChIJ123456789",
      kind: "details",
      value: { placeId: "ChIJ123456789" },
    })
    await Promise.all(writes)

    expect(put).toHaveBeenCalledWith(
      "places:v1:details:ChIJ123456789",
      JSON.stringify({ placeId: "ChIJ123456789" }),
      { expirationTtl: 2_592_000 },
    )
  })

  it("swallows KV write failures and logs a sanitized warning", async () => {
    const warn = vi.fn()
    const writes: Promise<unknown>[] = []
    const cache = new CloudflareKvJsonCache({
      namespace: createNamespace({ putError: new Error("KV unavailable") }).namespace,
      waitUntil: (promise) => writes.push(promise),
      logger: { warn },
    })

    cache.set({
      key: "places:v1:search:abc",
      kind: "search",
      value: [{ placeId: "ChIJ123456789" }],
    })
    await expect(Promise.all(writes)).resolves.toEqual([undefined])
    expect(warn).toHaveBeenCalledWith("Places cache write failed.", {
      kind: "search",
      error: expect.any(Error),
    })
  })
})
