import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import { isGoogleCanonicalReviewUrl } from "@/orpc-server/resource/qr/url"

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
  if (!placeId || !displayName) return null

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
    },
  ) {}

  async search({ query }: { query: string }): Promise<PlaceCandidate[]> {
    const response = await this.request("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.dependencies.apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 5 }),
    })

    if (!response.ok) {
      throw new QrDomainError(
        "PLACE_RESOLUTION_FAILED",
        "Google Places could not resolve that location.",
      )
    }

    const body = await readJson(response)
    const places = isJsonObject(body) && Array.isArray(body.places) ? body.places : []
    return places.flatMap((place) => {
      const candidate = candidateFromJson(place)
      return candidate ? [candidate] : []
    })
  }

  async getPlaceDetails({ placeId }: { placeId: string }): Promise<PlaceDetails> {
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
      throw new QrDomainError(
        "PLACE_RESOLUTION_FAILED",
        "Google Places could not confirm that location.",
      )
    }

    const body = await readJson(response)
    const candidate = candidateFromJson(body)
    const links =
      isJsonObject(body) && isJsonObject(body.googleMapsLinks) ? body.googleMapsLinks : null
    const canonicalReviewUrl = links ? stringValue(links.writeAReviewUri) : null
    if (
      !candidate ||
      candidate.placeId !== placeId ||
      !canonicalReviewUrl ||
      !isGoogleCanonicalReviewUrl(canonicalReviewUrl)
    ) {
      throw new QrDomainError(
        "PLACE_RESOLUTION_FAILED",
        "Google Places returned no canonical review URL for that location.",
      )
    }

    return { ...candidate, canonicalReviewUrl }
  }

  private request(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
    if (!this.dependencies.apiKey) {
      throw new QrDomainError(
        "PLACES_UNAVAILABLE",
        "Google Places is not configured on this server.",
      )
    }

    return (this.dependencies.fetcher ?? fetch)(input, init).catch((error: unknown) => {
      throw new QrDomainError("PLACES_UNAVAILABLE", "Google Places is unavailable.", {
        cause: error,
      })
    })
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch (error) {
    throw new QrDomainError(
      "PLACE_RESOLUTION_FAILED",
      "Google Places returned an invalid response.",
      {
        cause: error,
      },
    )
  }
}
