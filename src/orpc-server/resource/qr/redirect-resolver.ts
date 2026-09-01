import * as v from "valibot"

const RAPID_API_HOST = "seo-api2.p.rapidapi.com"
const RAPID_API_URL = `https://${RAPID_API_HOST}/redirect-checker`

export type RedirectProxyErrorCode =
  | "MISSING_CONFIGURATION"
  | "HTTP_FAILURE"
  | "INVALID_JSON"
  | "MALFORMED_RESPONSE"
  | "TRANSPORT_FAILURE"

export class RedirectProxyError extends Error {
  readonly name = "RedirectProxyError"
  readonly code: RedirectProxyErrorCode
  readonly status: number | undefined

  constructor(
    code: RedirectProxyErrorCode,
    message: string,
    options?: ErrorOptions & { status?: number },
  ) {
    super(message, options)
    this.code = code
    this.status = options?.status
  }
}

export interface GoogleMapsRedirectResolver {
  resolve(shortUrl: string): Promise<string>
}

type RapidApiRedirectResponse = {
  final_url: string
}

const rapidApiRedirectResponseSchema = v.object({
  final_url: v.pipe(v.string(), v.trim(), v.nonEmpty()),
})

type RapidApiRedirectResolverOptions = {
  apiKey?: string
  fetcher?: typeof fetch
}

export function createRapidApiRedirectResolver({
  apiKey,
  fetcher = fetch,
}: RapidApiRedirectResolverOptions): GoogleMapsRedirectResolver {
  return {
    async resolve(shortUrl: string): Promise<string> {
      if (!apiKey?.trim()) {
        throw new RedirectProxyError(
          "MISSING_CONFIGURATION",
          "RapidAPI redirect resolver is not configured.",
        )
      }

      const requestUrl = `${RAPID_API_URL}?url=${encodeURIComponent(shortUrl)}`
      let response: Response
      try {
        response = await fetcher(requestUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "x-rapidapi-host": RAPID_API_HOST,
            "x-rapidapi-key": apiKey,
          },
        })
      } catch (error) {
        throw new RedirectProxyError("TRANSPORT_FAILURE", "RapidAPI redirect request failed.", {
          cause: error,
        })
      }

      if (!response.ok) {
        throw new RedirectProxyError(
          "HTTP_FAILURE",
          "RapidAPI redirect request returned an error.",
          { status: response.status },
        )
      }

      let payload: unknown
      try {
        payload = await response.json()
      } catch (error) {
        throw new RedirectProxyError("INVALID_JSON", "RapidAPI returned invalid JSON.", {
          cause: error,
        })
      }

      try {
        const parsed: RapidApiRedirectResponse = v.parse(rapidApiRedirectResponseSchema, payload)
        return parsed.final_url
      } catch (error) {
        throw new RedirectProxyError(
          "MALFORMED_RESPONSE",
          "RapidAPI returned a malformed response.",
          { cause: error },
        )
      }
    },
  }
}
