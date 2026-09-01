import { configure, getConsoleSink, getJsonLinesFormatter, getLogger } from "@logtape/logtape"
import { redactByField } from "@logtape/redaction"

type LogTapeLogger = ReturnType<typeof getLogger>

export type AppLogger = Pick<LogTapeLogger, "debug" | "info" | "warn" | "error">

export type RequestContext = {
  requestId: string
  logger: AppLogger
}

let configurationPromise: Promise<void> | undefined

export function configureLogging(): Promise<void> {
  configurationPromise ??= configure({
    sinks: {
      console: redactByField(getConsoleSink({ formatter: getJsonLinesFormatter() })),
    },
    loggers: [
      {
        category: ["qr"],
        lowestLevel: "info",
        sinks: ["console"],
      },
    ],
  })

  return configurationPromise
}

export function getAppLogger(category: string[] = ["qr"]): AppLogger {
  return getLogger(category)
}

export function createRequestContext(request: Request): RequestContext {
  const requestId = getRequestId(request)
  const logger = getLogger(["qr", "http"]).with({
    requestId,
    method: request.method,
    pathname: new URL(request.url).pathname,
  })

  return { requestId, logger }
}

export function getRequestId(request: Request): string {
  const incoming = request.headers.get("x-request-id")?.trim()
  return incoming && isSafeRequestId(incoming) ? incoming : crypto.randomUUID()
}

export function withRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers)
  headers.set("X-Request-ID", requestId)

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function isSafeRequestId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
}
