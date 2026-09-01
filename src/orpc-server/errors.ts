export type DependencyErrorCode = "HEALTH_UNAVAILABLE" | "ORGANIZATION_UNAVAILABLE"

export class DependencyUnavailableError extends Error {
  readonly name = "DependencyUnavailableError"

  constructor(
    readonly code: DependencyErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}
