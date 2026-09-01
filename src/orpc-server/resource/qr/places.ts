import type { AppLogger } from "@/lib/logging"
import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import {
  isGoogleCanonicalReviewUrlForPlace,
  isGooglePlaceId,
  MAX_GOOGLE_MAPS_QUERY_LENGTH,
} from "@/orpc-server/resource/qr/url"

export type PlaceCandidate = {
  placeId: string
  name: string
  address: string | null
}

export type PlaceDetails = PlaceCandidate & {
  canonicalReviewUrl: string
}

export interface PlacesAdapter {
  search({ query }: { query: string }): Promise<PlaceCandidate[]>
  getPlaceDetails({ placeId }: { placeId: string }): Promise<PlaceDetails>
}

type JsonObject = Record<string, unknown>
const MAX_CANDIDATES = 5

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value ? value : null
}

function candidateFromJson(value: unknown): PlaceCandidate | null {
  if (!isJsonObject(value)) return null

  const placeId = stringValue(value.id)
  const displayName = isJsonObject(value.displayName) ? stringValue(value.displayName.text) : null
  if (!isGooglePlaceId(placeId) || !displayName) return null

  return {
    placeId,
    name: displayName,
    address: stringValue(value.formattedAddress),
  }
}

export class GooglePlacesAdapter implements PlacesAdapter {
  constructor(
    private readonly dependencies: {
      apiKey: string
      fetcher?: typeof fetch
      logger?: Pick<AppLogger, "warn">
    },
  ) {}

  async search({ query }: { query: string }): Promise<PlaceCandidate[]> {
    const normalizedQuery = normalizeGooglePlacesQuery(query)

    const response = await this.request("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.dependencies.apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
      },
      body: JSON.stringify({ textQuery: normalizedQuery, maxResultCount: MAX_CANDIDATES }),
    })

    if (!response.ok) {
      await this.logResponseFailure({ operation: "searchText", response })
      throwForResponse(response.status, "Google Places tidak dapat menemukan lokasi tersebut.")
    }

    const body = await readJson(response)
    const places = isJsonObject(body) && Array.isArray(body.places) ? body.places : []
    return places
      .flatMap((place) => {
        const candidate = candidateFromJson(place)
        return candidate ? [candidate] : []
      })
      .slice(0, MAX_CANDIDATES)
  }

  async getPlaceDetails({ placeId }: { placeId: string }): Promise<PlaceDetails> {
    if (!isGooglePlaceId(placeId)) {
      throw new QrDomainError("PLACE_RESOLUTION_FAILED", "ID Tempat Google tidak valid.")
    }

    const response = await this.request(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": this.dependencies.apiKey,
          "X-Goog-FieldMask": "id,displayName,formattedAddress,googleMapsLinks.writeAReviewUri",
        },
      },
    )

    if (!response.ok) {
      await this.logResponseFailure({ operation: "getPlaceDetails", response })
      throwForResponse(response.status, "Google Places tidak dapat mengonfirmasi lokasi tersebut.")
    }

    const body = await readJson(response)
    const candidate = candidateFromJson(body)
    const links =
      isJsonObject(body) && isJsonObject(body.googleMapsLinks) ? body.googleMapsLinks : null
    const writeAReviewUri = links ? stringValue(links.writeAReviewUri) : null
    if (
      !candidate ||
      candidate.placeId !== placeId ||
      !writeAReviewUri ||
      !isGoogleCanonicalReviewUrlForPlace(writeAReviewUri, placeId)
    ) {
      throw new QrDomainError(
        "PLACE_RESOLUTION_FAILED",
        "Google Places tidak mengembalikan URL ulasan kanonis untuk lokasi tersebut.",
      )
    }

    return { ...candidate, canonicalReviewUrl: writeAReviewUri }
  }

  private async request(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
    if (!this.dependencies.apiKey?.trim()) {
      throw new QrDomainError(
        "PLACES_UNAVAILABLE",
        "Google Places belum dikonfigurasi di server ini.",
      )
    }

    try {
      return await (this.dependencies.fetcher ?? fetch)(input, init)
    } catch (error: unknown) {
      throw new QrDomainError("PLACES_UNAVAILABLE", "Google Places tidak tersedia.", {
        cause: error,
      })
    }
  }

  private async logResponseFailure({
    operation,
    response,
  }: {
    operation: "searchText" | "getPlaceDetails"
    response: Response
  }): Promise<void> {
    const details = await readGoogleError(response)
    try {
      this.dependencies.logger?.warn("Google Places request failed.", {
        event: "google_places.request_failed",
        operation,
        httpStatus: response.status,
        googleCode: details.code,
        googleStatus: details.status,
        googleMessage: details.message,
      })
    } catch {
      // Logging must not change the provider error returned to the caller.
    }
  }
}

export function normalizeGooglePlacesQuery(query: string): string {
  const normalizedQuery = query.trim()
  if (!normalizedQuery || normalizedQuery.length > MAX_GOOGLE_MAPS_QUERY_LENGTH) {
    throw new QrDomainError("INVALID_INPUT", "Kueri tempat Google Maps tidak valid.")
  }
  return normalizedQuery
}

function throwForResponse(status: number, message: string): never {
  if (status === 401 || status === 403 || status === 408 || status === 429 || status >= 500) {
    throw new QrDomainError("PLACES_UNAVAILABLE", "Google Places tidak tersedia.")
  }

  throw new QrDomainError("PLACE_RESOLUTION_FAILED", message)
}

type GoogleErrorDetails = {
  code: string | number | null
  status: string | null
  message: string | null
}

async function readGoogleError(response: Response): Promise<GoogleErrorDetails> {
  try {
    const body: unknown = await response.clone().json()
    if (!isJsonObject(body) || !isJsonObject(body.error)) {
      return { code: null, status: null, message: null }
    }

    return {
      code: scalarValue(body.error.code),
      status: stringValue(body.error.status),
      message: boundedErrorMessage(body.error.message),
    }
  } catch {
    return { code: null, status: null, message: null }
  }
}

function scalarValue(value: unknown): string | number | null {
  return typeof value === "string" || typeof value === "number" ? value : null
}

function boundedErrorMessage(value: unknown): string | null {
  const message = stringValue(value)
  return message ? message.slice(0, 500) : null
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch (error) {
    throw new QrDomainError(
      "PLACES_UNAVAILABLE",
      "Google Places mengembalikan respons yang tidak valid.",
      {
        cause: error,
      },
    )
  }
}
