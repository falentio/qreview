import { QrDomainError } from "@/orpc-server/resource/qr/errors"

const allowedHosts = new Set(["google.com", "www.google.com", "maps.google.com"])
export const MAX_GOOGLE_MAPS_URL_LENGTH = 2048
export const MAX_GOOGLE_MAPS_QUERY_LENGTH = 200

export type ParsedGoogleMapsUrl = {
  rawUrl: string
  placeId: string | null
  query: string | null
}

export function isGooglePlaceId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{10,}$/.test(value)
}

function findPlaceId(url: URL): string | null {
  const queryPlaceId = url.searchParams.get("query_place_id") ?? url.searchParams.get("place_id")
  if (isGooglePlaceId(queryPlaceId)) return queryPlaceId

  const decodedUrl = decodeUrlPart(url.href)
  const dataPlaceId = decodedUrl.match(/(?:!1s|place_id:)([A-Za-z0-9_-]{10,})/i)?.[1] ?? null
  if (isGooglePlaceId(dataPlaceId)) return dataPlaceId

  const pathPlaceId =
    decodeUrlPart(url.pathname).match(/\/place\/(ChI[A-Za-z0-9_-]{8,})(?:\/|$)/)?.[1] ?? null
  return isGooglePlaceId(pathPlaceId) ? pathPlaceId : null
}

function findQuery(url: URL, placeId: string | null): string | null {
  const query = url.searchParams.get("query") ?? url.searchParams.get("q")
  const normalizedQuery = query?.trim()
  if (normalizedQuery) return boundedQuery(normalizedQuery)

  const path = decodeUrlPart(url.pathname)
  const placePath = path.match(/\/maps\/(?:place|search)\/([^/]+)/i)?.[1]
  if (!placePath || placePath === placeId) return null

  const readablePath = placePath.replace(/\+/g, " ").replace(/,@.*$/, "").trim()
  return readablePath ? boundedQuery(readablePath) : null
}

function boundedQuery(value: string): string {
  if (value.length > MAX_GOOGLE_MAPS_QUERY_LENGTH) {
    throw new QrDomainError("INVALID_GOOGLE_MAPS_URL", "The Google Maps place query is too long.")
  }
  return value
}

function decodeUrlPart(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function parseGoogleMapsUrl(rawValue: string): ParsedGoogleMapsUrl {
  const rawUrl = rawValue.trim()
  if (rawUrl.length > MAX_GOOGLE_MAPS_URL_LENGTH) {
    throw new QrDomainError("INVALID_GOOGLE_MAPS_URL", "The Google Maps URL is too long.")
  }
  let url: URL

  try {
    url = new URL(rawUrl)
  } catch (error) {
    throw new QrDomainError("INVALID_GOOGLE_MAPS_URL", "The Google Maps URL is invalid.", {
      cause: error,
    })
  }

  const hostname = url.hostname.toLowerCase()
  if (
    url.protocol !== "https:" ||
    !allowedHosts.has(hostname) ||
    url.username ||
    url.password ||
    url.port ||
    !/^\/maps(?:\/|$)/i.test(url.pathname)
  ) {
    throw new QrDomainError("INVALID_GOOGLE_MAPS_URL", "Only HTTPS Google Maps URLs are supported.")
  }

  const placeId = findPlaceId(url)
  const query = findQuery(url, placeId)
  if (!placeId && !query) {
    throw new QrDomainError(
      "INVALID_GOOGLE_MAPS_URL",
      "The Google Maps URL does not identify a place.",
    )
  }

  return { rawUrl, placeId, query }
}

export function isGoogleCanonicalReviewUrl(value: string): boolean {
  try {
    const url = new URL(value)
    const hostname = url.hostname.toLowerCase()
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) {
      return false
    }

    if (
      hostname === "search.google.com" &&
      url.pathname === "/local/writereview" &&
      url.searchParams.size === 1
    ) {
      return isGooglePlaceId(url.searchParams.get("placeid"))
    }

    return (
      hostname === "www.google.com" &&
      !url.search &&
      url.pathname.match(/^\/maps\/place\/\/data=!4m3!3m2!1s0x[0-9a-f]+:0x[0-9a-f]+!12e1$/i) !==
        null
    )
  } catch {
    return false
  }
}

export function isGoogleCanonicalReviewUrlForPlace(value: string, placeId: string): boolean {
  if (!isGoogleCanonicalReviewUrl(value)) return false

  try {
    const url = new URL(value)
    if (url.hostname.toLowerCase() !== "search.google.com") return true
    return url.searchParams.get("placeid") === placeId
  } catch {
    return false
  }
}
