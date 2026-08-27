import type { QrRecord } from "@/orpc-server/resource/qr/repository"

export const actor = { id: "user-1", role: "user" }
export const owner = { id: "owner-1", role: "user" }
export const globalAdmin = { id: "admin-1", role: "admin" }

export function createQrRecord(overrides: Partial<QrRecord> = {}): QrRecord {
  const timestamp = new Date("2030-01-01T00:00:00.000Z")
  return {
    id: "qr-1",
    alias: "Example location",
    slug: "abc123def4",
    rawGoogleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Example",
    googlePlaceId: "ChIJ123456789",
    canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ123456789",
    organizationId: "org-1",
    createdById: "user-1",
    claimedById: null,
    claimedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    ...overrides,
  }
}
