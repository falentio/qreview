import { describe, expect, it, vi } from "vite-plus/test"

import {
  CloudflareQrPublicProjectionCache,
  type KvStore,
  type QrPublicProjection,
} from "@/orpc-server/resource/qr/public-cache"

const activeProjection: QrPublicProjection = {
  schemaVersion: 2,
  slug: "abc123def4",
  qrCodeId: "qr-1",
  state: "active",
  googlePlaceId: "ChIJ123456789",
  canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ123456789",
  expiresAt: null,
  updatedAt: "2030-01-01T00:00:00.000Z",
}

function createNamespace(initialValue: string | null = null) {
  const values = new Map<string, string>()
  if (initialValue !== null) values.set("qr-public:v2:abc123def4", initialValue)
  const get = vi.fn(async (key: string) => values.get(key) ?? null)
  const put = vi.fn(async (key: string, value: string) => {
    values.set(key, value)
  })
  return { namespace: { get, put } as unknown as KvStore, get, put, values }
}

describe("CloudflareQrPublicProjectionCache", () => {
  it("returns a valid active projection from KV", async () => {
    const { namespace, get } = createNamespace(JSON.stringify(activeProjection))
    const cache = new CloudflareQrPublicProjectionCache({
      namespace,
      waitUntil: () => undefined,
    })

    await expect(cache.get({ slug: activeProjection.slug })).resolves.toEqual(activeProjection)
    expect(get).toHaveBeenCalledWith("qr-public:v2:abc123def4", "text")
  })

  it("treats malformed and invalid projections as cache misses", async () => {
    const warn = vi.fn()
    const invalidProjection = {
      ...activeProjection,
      canonicalReviewUrl: "https://evil.example.com",
    }
    const { namespace } = createNamespace(JSON.stringify(invalidProjection))
    const cache = new CloudflareQrPublicProjectionCache({
      namespace,
      waitUntil: () => undefined,
      logger: { warn },
    })

    await expect(cache.get({ slug: activeProjection.slug })).resolves.toBeNull()
    expect(warn).toHaveBeenCalledWith("QR public projection read failed.", {
      slug: activeProjection.slug,
      error: expect.any(Error),
    })
  })

  it("treats KV read failures as cache misses", async () => {
    const warn = vi.fn()
    const namespace = {
      get: vi.fn(async () => {
        throw new Error("KV unavailable")
      }),
      put: vi.fn(async () => undefined),
    } as unknown as KvStore
    const cache = new CloudflareQrPublicProjectionCache({
      namespace,
      waitUntil: () => undefined,
      logger: { warn },
    })

    await expect(cache.get({ slug: activeProjection.slug })).resolves.toBeNull()
    expect(warn).toHaveBeenCalledWith("QR public projection read failed.", {
      slug: activeProjection.slug,
      error: expect.any(Error),
    })
  })

  it("publishes projections with a seven-day TTL", async () => {
    const { namespace, put } = createNamespace()
    const writes: Promise<unknown>[] = []
    const cache = new CloudflareQrPublicProjectionCache({
      namespace,
      waitUntil: (promise) => writes.push(promise),
    })

    cache.set(activeProjection)
    await Promise.all(writes)

    expect(put).toHaveBeenCalledWith("qr-public:v2:abc123def4", JSON.stringify(activeProjection), {
      expirationTtl: 604_800,
    })
  })

  it("awaits projection writes when requested", async () => {
    const { namespace, put } = createNamespace()
    const cache = new CloudflareQrPublicProjectionCache({
      namespace,
      waitUntil: () => undefined,
    })

    await cache.setAndWait?.(activeProjection)

    expect(put).toHaveBeenCalledWith("qr-public:v2:abc123def4", JSON.stringify(activeProjection), {
      expirationTtl: 604_800,
    })
  })
})
