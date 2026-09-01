import { describe, expect, it, vi } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { AppLogger } from "@/lib/logging"
import type { QrRedirectedEvent } from "@/orpc-server/events"
import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import { createQrPublicResponse } from "@/orpc-server/resource/qr/public"
import type { PlacesAdapter } from "@/orpc-server/resource/qr/places"
import { createQrRecord } from "@/orpc-server/resource/qr/fixtures"
import type { QrRecord, QrRepository } from "@/orpc-server/resource/qr/repository"
import { QrService } from "@/orpc-server/resource/qr/service"

const reviewUrl =
  "https://www.google.com/maps/place//data=!4m3!3m2!1s0x2e78872eb95f61c3:0x524dc00ed3a1a6ec!12e1?g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA"

function setup(
  record: QrRecord | null,
  onQrRedirected?: (event: QrRedirectedEvent) => void,
  logger?: Partial<Pick<AppLogger, "error" | "warn">>,
) {
  const repository = mock<QrRepository>()
  const places = mock<PlacesAdapter>()
  repository.findBySlug.mockResolvedValue(record)
  const service = new QrService({
    repository,
    places,
    clock: { now: () => new Date("2030-01-02T00:00:00.000Z") },
    ids: {
      generateId: () => "generated-id",
      generateSlug: () => "generated1a",
    },
  })
  return createQrPublicResponse({ service, onQrRedirected, logger })
}

describe("createQrPublicResponse", () => {
  it("emits an active redirect event through the request execution context", async () => {
    const events: QrRedirectedEvent[] = []
    const pending: Promise<unknown>[] = []
    const publicResponse = setup(createQrRecord(), (event) => events.push(event))

    const response = await publicResponse({
      slug: "abc123def4",
      waitUntil: (promise) => pending.push(promise),
    })
    await Promise.all(pending)

    expect(response.status).toBe(307)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: "qr.redirected", qrCodeId: "qr-1" })
    expect(events[0]?.occurredAt).toBeInstanceOf(Date)
  })

  it("keeps the redirect successful when the event listener fails", async () => {
    const pending: Promise<unknown>[] = []
    const error = vi.fn()
    const publicResponse = setup(
      createQrRecord(),
      () => {
        throw new Error("analytics unavailable")
      },
      { error },
    )

    const response = await publicResponse({
      slug: "abc123def4",
      waitUntil: (promise) => pending.push(promise),
    })
    await Promise.all(pending)

    expect(response.status).toBe(307)
    expect(error).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ event: "qr.redirect.analytics_failed", qrCodeId: "qr-1" }),
    )
  })

  it("keeps the redirect successful when event scheduling fails", async () => {
    const error = vi.fn()
    const events: QrRedirectedEvent[] = []
    const publicResponse = setup(createQrRecord(), (event) => events.push(event), { error })

    const response = await publicResponse({
      slug: "abc123def4",
      waitUntil: () => {
        throw new Error("execution context unavailable")
      },
    })

    await new Promise<void>((resolve) => queueMicrotask(resolve))
    expect(response.status).toBe(307)
    expect(events).toHaveLength(1)
    expect(error).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        event: "qr.redirect.analytics_scheduling_failed",
        qrCodeId: "qr-1",
      }),
    )
  })

  it("does not emit redirect events for setup responses", async () => {
    const events: QrRedirectedEvent[] = []
    const publicResponse = setup(
      createQrRecord({
        rawGoogleMapsUrl: null,
        googlePlaceId: null,
        canonicalReviewUrl: null,
      }),
      (event) => events.push(event),
    )

    const response = await publicResponse({ slug: "abc123def4" })

    expect(response.status).toBe(200)
    expect(events).toHaveLength(0)
  })

  it("redirects active QR codes without allowing the redirect to be cached", async () => {
    const publicResponse = setup(createQrRecord())

    const response = await publicResponse({ slug: "abc123def4" })

    expect(response.status).toBe(307)
    expect(response.headers.get("Location")).toBe(
      "https://search.google.com/local/writereview?placeid=ChIJ123456789",
    )
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })

  it("redirects a configured orphan QR code", async () => {
    const publicResponse = setup(
      createQrRecord({ organizationId: null, canonicalReviewUrl: reviewUrl }),
    )

    const response = await publicResponse({ slug: "abc123def4" })

    expect(response.status).toBe(307)
    expect(response.headers.get("Location")).toBe(reviewUrl)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })

  it("returns a neutral setup response for incomplete QR codes", async () => {
    for (const record of [
      createQrRecord({
        organizationId: null,
        rawGoogleMapsUrl: null,
        googlePlaceId: null,
        canonicalReviewUrl: null,
      }),
      createQrRecord({ rawGoogleMapsUrl: null }),
    ]) {
      const publicResponse = setup(record)

      const response = await publicResponse({ slug: "abc123def4" })

      expect(response.status).toBe(200)
      expect(await response.text()).toContain("belum dikonfigurasi")
      expect(response.headers.get("Cache-Control")).toBe("no-store")
      expect(response.headers.get("Location")).toBeNull()
    }
  })

  it("returns 410 for expired QR codes without emitting redirect events", async () => {
    const events: QrRedirectedEvent[] = []
    const publicResponse = setup(
      createQrRecord({ expiresAt: new Date("2030-01-02T00:00:00.000Z") }),
      (event) => events.push(event),
    )

    const response = await publicResponse({ slug: "abc123def4" })

    expect(response.status).toBe(410)
    expect(await response.text()).toContain("kedaluwarsa")
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(events).toHaveLength(0)
  })

  it("returns 410 before setup handling for an expired incomplete QR code", async () => {
    const publicResponse = setup(
      createQrRecord({
        rawGoogleMapsUrl: null,
        googlePlaceId: null,
        canonicalReviewUrl: null,
        expiresAt: new Date("2030-01-02T00:00:00.000Z"),
      }),
    )

    const response = await publicResponse({ slug: "abc123def4" })

    expect(response.status).toBe(410)
  })

  it("does not redirect to an invalid stored canonical URL", async () => {
    for (const canonicalReviewUrl of [
      "https://evil.google.com/not-a-review",
      "https://search.google.com/local/writereview?placeid=ChIJ987654321",
    ]) {
      const publicResponse = setup(createQrRecord({ canonicalReviewUrl }))

      const response = await publicResponse({ slug: "abc123def4" })

      expect(response.status).toBe(200)
      expect(await response.text()).toContain("belum dikonfigurasi")
    }
  })

  it("does not redirect when the stored Maps URL is malformed or conflicts with its Place ID", async () => {
    for (const rawGoogleMapsUrl of [
      "not-a-google-maps-url",
      "https://www.google.com/maps/search/?query=Example&query_place_id=ChIJ987654321",
    ]) {
      const publicResponse = setup(createQrRecord({ rawGoogleMapsUrl }))

      const response = await publicResponse({ slug: "abc123def4" })

      expect(response.status).toBe(200)
      expect(await response.text()).toContain("belum dikonfigurasi")
    }
  })

  it("returns 404 for archived or missing QR codes", async () => {
    for (const record of [null, createQrRecord({ deletedAt: new Date() })]) {
      const publicResponse = setup(record)

      const response = await publicResponse({ slug: "abc123def4" })

      expect(response.status).toBe(404)
      expect(response.headers.get("Cache-Control")).toBe("no-store")
    }
  })

  it("returns a temporary unavailable response when public resolution cannot use either store", async () => {
    const warn = vi.fn()
    const service = {
      resolvePublic: vi.fn(async () => {
        throw new QrDomainError("PUBLIC_UNAVAILABLE", "QR redirects are temporarily unavailable.")
      }),
    }

    const response = await createQrPublicResponse({ service, logger: { warn } })({
      slug: "abc123def4",
    })

    expect(response.status).toBe(503)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(warn).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ event: "qr.public.unavailable" }),
    )
  })
})
