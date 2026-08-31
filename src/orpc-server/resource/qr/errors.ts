export type QrErrorCode =
  | "INVALID_INPUT"
  | "INVALID_GOOGLE_MAPS_URL"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "ARCHIVED"
  | "PLACE_RESOLUTION_FAILED"
  | "PLACES_UNAVAILABLE"
  | "PUBLIC_UNAVAILABLE"
  | "SLUG_CONFLICT"

export type QrOrpcErrorCode =
  | "BAD_REQUEST"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "SERVICE_UNAVAILABLE"

const orpcCodeForQrError: Record<QrErrorCode, QrOrpcErrorCode> = {
  INVALID_INPUT: "BAD_REQUEST",
  INVALID_GOOGLE_MAPS_URL: "BAD_REQUEST",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  ARCHIVED: "CONFLICT",
  PLACE_RESOLUTION_FAILED: "BAD_REQUEST",
  PLACES_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  PUBLIC_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  SLUG_CONFLICT: "CONFLICT",
}

export class QrDomainError extends Error {
  readonly name = "QrDomainError"
  readonly code: QrErrorCode
  readonly httpCode: QrOrpcErrorCode

  constructor(code: QrErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.code = code
    this.httpCode = orpcCodeForQrError[code]
  }
}
