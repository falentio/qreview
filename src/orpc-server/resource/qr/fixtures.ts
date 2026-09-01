import type { QrRecord } from "@/orpc-server/resource/qr/repository"

export const actor = { id: "user-1", role: "user" }
export const owner = { id: "owner-1", role: "user" }
export const globalAdmin = { id: "admin-1", role: "admin" }
export const googleFeatureId = "0x2e7887b579f3d48f:0x6ec81fc2711b27a"
export const googlePlaceId = "ChIJj9TzebWHeC4RerIRJ_yB7AY"
export const googleMapsUrl =
  "https://www.google.com/maps/search/?api=1&query=Example&query_place_id=ChIJj9TzebWHeC4RerIRJ_yB7AY"
export const googleCanonicalReviewUrl =
  "https://www.google.com/maps/place//data=!4m3!3m2!1s0x2e7887b579f3d48f:0x6ec81fc2711b27a!12e1"

export function createQrRecord(overrides: Partial<QrRecord> = {}): QrRecord {
  const timestamp = new Date("2030-01-01T00:00:00.000Z")
  const organizationId = overrides.organizationId === undefined ? "org-1" : overrides.organizationId
  return {
    id: "qr-1",
    alias: "Example location",
    slug: "abc123def4",
    rawGoogleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Example",
    googlePlaceId: "ChIJ123456789",
    canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ123456789",
    organizationId,
    createdById: "user-1",
    claimedById: null,
    claimedAt: null,
    expiresAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    ...overrides,
    claimable: overrides.claimable ?? organizationId === null,
  }
}
