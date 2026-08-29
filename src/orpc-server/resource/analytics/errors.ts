export type AnalyticsErrorCode = "INVALID_INPUT" | "FORBIDDEN" | "NOT_FOUND"

export type AnalyticsOrpcErrorCode = "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND"

const orpcCodeForAnalyticsError: Record<AnalyticsErrorCode, AnalyticsOrpcErrorCode> = {
  INVALID_INPUT: "BAD_REQUEST",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
}

export class AnalyticsDomainError extends Error {
  readonly name = "AnalyticsDomainError"
  readonly httpCode: AnalyticsOrpcErrorCode

  constructor(
    readonly code: AnalyticsErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.httpCode = orpcCodeForAnalyticsError[code]
  }
}
