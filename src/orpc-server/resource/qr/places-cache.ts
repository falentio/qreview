import { CloudflareKvJsonCache, type CacheKind } from "@/orpc-server/resource/qr/cache"
import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import { isGoogleCanonicalReviewUrlForPlace, isGooglePlaceId } from "@/orpc-server/resource/qr/url"
import {
  normalizeGooglePlacesQuery,
  type PlaceCandidate,
  type PlaceDetails,
  type PlacesAdapter,
} from "@/orpc-server/resource/qr/places"

type JsonObject = Record<string, unknown>
type CacheLogger = Pick<Console, "warn">

export class CachedPlacesAdapter implements PlacesAdapter {
  private readonly places: PlacesAdapter
  private readonly cache: CloudflareKvJsonCache
  private readonly logger: CacheLogger

  constructor({
    places,
    cache,
    logger = console,
  }: {
    places: PlacesAdapter
    cache: CloudflareKvJsonCache
    logger?: CacheLogger
  }) {
    this.places = places
    this.cache = cache
    this.logger = logger
  }

  async search({ query }: { query: string }): Promise<PlaceCandidate[]> {
    const normalizedQuery = normalizeGooglePlacesQuery(query)
    const key = await searchCacheKey(normalizedQuery)
    const cached = await this.cache.get<unknown>({ key, kind: "search" })
    if (isPlaceCandidateList(cached)) return cached
    if (cached !== null) this.warnInvalidCache("search")

    const candidates = await this.places.search({ query: normalizedQuery })
    if (candidates.length > 0 && isPlaceCandidateList(candidates)) {
      this.cache.set({ key, kind: "search", value: candidates })
    }
    return candidates
  }

  async getPlaceDetails({ placeId }: { placeId: string }): Promise<PlaceDetails> {
    if (!isGooglePlaceId(placeId)) {
      throw new QrDomainError("PLACE_RESOLUTION_FAILED", "The Google Place ID is invalid.")
    }

    const key = `places:v1:details:${placeId}`
    const cached = await this.cache.get<unknown>({ key, kind: "details" })
    if (isPlaceDetailsForPlace(cached, placeId)) return cached
    if (cached !== null) this.warnInvalidCache("details")

    const details = await this.places.getPlaceDetails({ placeId })
    if (isPlaceDetailsForPlace(details, placeId)) {
      this.cache.set({ key, kind: "details", value: details })
    }
    return details
  }

  private warnInvalidCache(kind: CacheKind): void {
    this.logger.warn("Places cache validation failed.", { kind })
  }
}

async function searchCacheKey(query: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(query))
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  )
  return `places:v1:search:${hex}`
}

function isPlaceCandidateList(value: unknown): value is PlaceCandidate[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 5 &&
    value.every((candidate) => isPlaceCandidate(candidate))
  )
}

function isPlaceDetailsForPlace(value: unknown, placeId: string): value is PlaceDetails {
  if (!isJsonObject(value) || !isPlaceCandidate(value)) return false
  const canonicalReviewUrl = value as JsonObject
  return (
    value.placeId === placeId &&
    typeof canonicalReviewUrl.canonicalReviewUrl === "string" &&
    isGoogleCanonicalReviewUrlForPlace(canonicalReviewUrl.canonicalReviewUrl, placeId)
  )
}

function isPlaceCandidate(value: unknown): value is PlaceCandidate {
  if (!isJsonObject(value)) return false
  return (
    isGooglePlaceId(value.placeId) &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    (value.address === null || (typeof value.address === "string" && value.address.length > 0))
  )
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null
}
