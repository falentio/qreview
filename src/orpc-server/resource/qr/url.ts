import { QrDomainError } from "./errors.ts"
import type { AppLogger } from "@/lib/logging"

const allowedHosts = new Set(["google.com", "www.google.com", "maps.google.com"])
const shortUrlHost = "maps.app.goo.gl"
export const MAX_GOOGLE_MAPS_URL_LENGTH = 2048
export const MAX_GOOGLE_MAPS_QUERY_LENGTH = 200

export type ParsedGoogleMapsUrl = {
  rawUrl: string
  placeId: string | null
  featureId: string | null
  query: string | null
}

export function isGooglePlaceId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{10,}$/.test(value)
}

type GoogleFeatureIdParts = {
  high: bigint
  low: bigint
}

const GOOGLE_FEATURE_ID_PATTERN = /^0x([0-9a-f]{1,16}):0x([0-9a-f]{1,16})$/i

function parseFeatureId(value: string): GoogleFeatureIdParts | null {
  const match = GOOGLE_FEATURE_ID_PATTERN.exec(value)
  if (!match?.[1] || !match[2]) return null

  return {
    high: BigInt(`0x${match[1]}`),
    low: BigInt(`0x${match[2]}`),
  }
}

function formatFeatureId({ high, low }: GoogleFeatureIdParts): string {
  return `0x${high.toString(16)}:0x${low.toString(16)}`
}

function dataSources(url: URL): string[] {
  const decodedPathname = decodeUrlPart(url.pathname)
  const dataIndex = decodedPathname.indexOf("/data=")
  const sources = dataIndex >= 0 ? [decodedPathname.slice(dataIndex + "/data=".length)] : []
  const data = url.searchParams.get("data")
  if (data) sources.push(decodeUrlPart(data))
  return sources
}

function findPlaceIdInData(value: string): string | null {
  const placeId = value.match(/(?:^|!)1s(ChI[A-Za-z0-9_-]{8,})(?:!|$)/i)?.[1] ?? null
  return isGooglePlaceId(placeId) ? placeId : null
}

function findExplicitPlaceId(url: URL): string | null {
  const queryPlaceId = url.searchParams.get("query_place_id") ?? url.searchParams.get("place_id")
  if (isGooglePlaceId(queryPlaceId)) return queryPlaceId

  for (const source of dataSources(url)) {
    const dataPlaceId =
      findPlaceIdInData(source) ?? source.match(/place_id:([A-Za-z0-9_-]{10,})/i)?.[1] ?? null
    if (isGooglePlaceId(dataPlaceId)) return dataPlaceId
  }

  const pathPlaceId =
    decodeUrlPart(url.pathname).match(/\/place\/(ChI[A-Za-z0-9_-]{8,})(?:\/|$)/)?.[1] ?? null
  return isGooglePlaceId(pathPlaceId) ? pathPlaceId : null
}

function findFeatureId(url: URL): string | null {
  for (const source of dataSources(url)) {
    const match = source.match(/(?:^|!)1s(0x[0-9a-f]{1,16}:0x[0-9a-f]{1,16})(?:!|$)/i)
    const parts = match?.[1] ? parseFeatureId(match[1]) : null
    if (parts) return formatFeatureId(parts)
  }
  return null
}

function canonicalFeatureIdFromPath(pathname: string): string | null {
  const match = pathname.match(
    /^\/maps\/place\/\/data=!4m3!3m2!1s(0x[0-9a-f]{1,16}:0x[0-9a-f]{1,16})!12e1$/i,
  )
  const parts = match?.[1] ? parseFeatureId(match[1]) : null
  return parts ? formatFeatureId(parts) : null
}

function encodeBase64Url(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes)
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
}

function decodeBase64Url(value: string): Uint8Array | null {
  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/")
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
    const binary = atob(padded)
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    return null
  }
}

export function googlePlaceIdFromFeatureId(value: string): string | null {
  const parts = parseFeatureId(value)
  if (!parts) return null

  const bytes = new Uint8Array(20)
  bytes[0] = 0x0a
  bytes[1] = 0x12
  bytes[2] = 0x09
  bytes[11] = 0x11

  const view = new DataView(bytes.buffer)
  view.setBigUint64(3, parts.high, true)
  view.setBigUint64(12, parts.low, true)
  return encodeBase64Url(bytes)
}

export function googleFeatureIdFromPlaceId(value: string): string | null {
  if (!isGooglePlaceId(value)) return null

  const bytes = decodeBase64Url(value)
  if (
    !bytes ||
    bytes.length !== 20 ||
    bytes[0] !== 0x0a ||
    bytes[1] !== 0x12 ||
    bytes[2] !== 0x09 ||
    bytes[11] !== 0x11
  ) {
    return null
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return formatFeatureId({ high: view.getBigUint64(3, true), low: view.getBigUint64(12, true) })
}

export function createGoogleCanonicalReviewUrl({
  placeId,
  featureId,
}: {
  placeId: string
  featureId?: string | null
}): string | null {
  if (!isGooglePlaceId(placeId)) return null

  const resolvedFeatureId = featureId ?? googleFeatureIdFromPlaceId(placeId)
  if (!resolvedFeatureId || googlePlaceIdFromFeatureId(resolvedFeatureId) !== placeId) return null

  return `https://www.google.com/maps/place//data=!4m3!3m2!1s${resolvedFeatureId}!12e1`
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
    throw new QrDomainError("INVALID_GOOGLE_MAPS_URL", "Kueri tempat Google Maps terlalu panjang.")
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

type RawGoogleMapsUrl = {
  rawUrl: string
  url: URL
}

function parseRawGoogleMapsUrl(rawValue: string): RawGoogleMapsUrl {
  const rawUrl = rawValue.trim()
  if (rawUrl.length > MAX_GOOGLE_MAPS_URL_LENGTH) {
    throw new QrDomainError("INVALID_GOOGLE_MAPS_URL", "URL Google Maps terlalu panjang.")
  }
  let url: URL

  try {
    url = new URL(rawUrl)
  } catch (error) {
    throw new QrDomainError("INVALID_GOOGLE_MAPS_URL", "URL Google Maps tidak valid.", {
      cause: error,
    })
  }

  return { rawUrl, url }
}

function isGoogleMapsShortUrlValue(url: URL): boolean {
  return (
    url.protocol === "https:" &&
    url.hostname.toLowerCase() === shortUrlHost &&
    !url.username &&
    !url.password &&
    !url.port &&
    /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
  )
}

export function isGoogleMapsShortUrl(rawValue: string): boolean {
  try {
    return isGoogleMapsShortUrlValue(parseRawGoogleMapsUrl(rawValue).url)
  } catch {
    return false
  }
}

export async function resolveGoogleMapsUrl(
  rawValue: string,
  fetcher: typeof fetch = fetch,
  logger?: Pick<AppLogger, "warn">,
): Promise<ParsedGoogleMapsUrl> {
  const { rawUrl, url } = parseRawGoogleMapsUrl(rawValue)
  if (!isGoogleMapsShortUrlValue(url)) return parseGoogleMapsUrl(rawUrl)

  let currentUrl = rawUrl
  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    let response: Response
    try {
      response = await fetcher(currentUrl, { redirect: "manual" })
    } catch (error) {
      logger?.warn("Google Maps short URL request failed.", {
        event: "google_maps.short_url_request_failed",
        errorName: error instanceof Error ? error.name : typeof error,
      })
      throw new QrDomainError(
        "PLACE_RESOLUTION_FAILED",
        "URL singkat Google Maps tidak dapat diproses.",
        {
          cause: error,
        },
      )
    }

    const location = response.headers.get("location") || response.url || currentUrl
    if (response.status >= 300 && response.status < 400) {
      if (!location || location === currentUrl || redirectCount === 5) {
        throwShortUrlResolutionError(logger, response)
      }
      currentUrl = validateRedirectDestination(currentUrl, location)
      continue
    }

    if (!response.ok || !location) {
      throwShortUrlResolutionError(logger, response)
    }
    const resolvedUrl = validateRedirectDestination(currentUrl, location)
    if (resolvedUrl === rawUrl) throwShortUrlResolutionError(logger, response)
    return { ...parseGoogleMapsUrl(resolvedUrl), rawUrl }
  }

  throw new QrDomainError(
    "PLACE_RESOLUTION_FAILED",
    "URL singkat Google Maps tidak dapat diproses.",
  )
}

function validateRedirectDestination(currentUrl: string, location: string): string {
  let destination: URL
  try {
    destination = new URL(location, currentUrl)
  } catch (error) {
    throw new QrDomainError(
      "PLACE_RESOLUTION_FAILED",
      "URL singkat Google Maps tidak dapat diproses.",
      {
        cause: error,
      },
    )
  }

  if (isGoogleMapsShortUrlValue(destination)) return destination.href

  try {
    parseGoogleMapsUrl(destination.href)
  } catch (error) {
    throw new QrDomainError(
      "PLACE_RESOLUTION_FAILED",
      "URL singkat Google Maps mengarah ke tujuan yang tidak didukung.",
      { cause: error },
    )
  }
  return destination.href
}

function throwShortUrlResolutionError(
  logger: Pick<AppLogger, "warn"> | undefined,
  response: Response,
): never {
  logger?.warn("Google Maps short URL could not be processed.", {
    event: "google_maps.short_url_resolution_failed",
    httpStatus: response.status,
    redirected: response.redirected,
    responseUrlPresent: Boolean(response.url),
    responseUrlMatchesInput: false,
  })
  throw new QrDomainError(
    "PLACE_RESOLUTION_FAILED",
    "URL singkat Google Maps tidak dapat diproses.",
  )
}

export function parseGoogleMapsUrl(rawValue: string): ParsedGoogleMapsUrl {
  const { rawUrl, url } = parseRawGoogleMapsUrl(rawValue)

  const hostname = url.hostname.toLowerCase()
  if (
    url.protocol !== "https:" ||
    !allowedHosts.has(hostname) ||
    url.username ||
    url.password ||
    url.port ||
    !/^\/maps(?:\/|$)/i.test(url.pathname)
  ) {
    throw new QrDomainError("INVALID_GOOGLE_MAPS_URL", "Hanya URL Google Maps HTTPS yang didukung.")
  }

  const explicitPlaceId = findExplicitPlaceId(url)
  const featureId = findFeatureId(url)
  const derivedPlaceId = featureId ? googlePlaceIdFromFeatureId(featureId) : null
  if (explicitPlaceId && derivedPlaceId && explicitPlaceId !== derivedPlaceId) {
    throw new QrDomainError(
      "INVALID_GOOGLE_MAPS_URL",
      "URL Google Maps memiliki ID tempat yang tidak konsisten.",
    )
  }

  const placeId = explicitPlaceId ?? derivedPlaceId
  const query = findQuery(url, placeId)
  if (!placeId && !query) {
    throw new QrDomainError(
      "INVALID_GOOGLE_MAPS_URL",
      "URL Google Maps tidak mengidentifikasi tempat.",
    )
  }

  return {
    rawUrl,
    placeId,
    featureId: featureId ?? (placeId ? googleFeatureIdFromPlaceId(placeId) : null),
    query,
  }
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
      canonicalFeatureIdFromPath(url.pathname) !== null &&
      (!url.search || (url.searchParams.size === 1 && Boolean(url.searchParams.get("g_mp"))))
    )
  } catch {
    return false
  }
}

export function isGoogleCanonicalReviewUrlForPlace(value: string, placeId: string): boolean {
  if (!isGoogleCanonicalReviewUrl(value)) return false

  try {
    const url = new URL(value)
    if (url.hostname.toLowerCase() === "search.google.com") {
      return url.searchParams.get("placeid") === placeId
    }

    const featureId = canonicalFeatureIdFromPath(url.pathname)
    return Boolean(featureId && googlePlaceIdFromFeatureId(featureId) === placeId)
  } catch {
    return false
  }
}
