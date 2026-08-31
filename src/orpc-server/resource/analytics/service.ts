import type { QrRedirectedEvent } from "@/orpc-server/events"
import { AnalyticsDomainError } from "@/orpc-server/resource/analytics/errors"
import type { QrAnalyticsRepository } from "@/orpc-server/resource/analytics/repository"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"
import type { QrActor } from "@/orpc-server/resource/qr/service"

const HOUR_MS = 60 * 60 * 1000
const RETENTION_MS = 60 * 24 * HOUR_MS
const MAX_FILL_RANGE_MS = 30 * 24 * HOUR_MS
const MAX_REDIRECT_ATTEMPTS = 1_000_000

export type QrHourlyAnalyticsResponse = {
  items: Array<{
    hour: string
    redirectAttempts: number
  }>
}

export class AnalyticsService {
  constructor(
    private readonly dependencies: {
      repository: Pick<
        QrAnalyticsRepository,
        | "incrementRedirectAttempts"
        | "listHourly"
        | "listOrganizationHourly"
        | "fillHourly"
        | "deleteOlderThan"
      >
      qrRepository: Pick<QrRepository, "findById" | "findBySlug" | "getOrganizationMemberRole">
      clock?: { now(): Date }
    },
  ) {}

  async recordRedirect({ qrCodeId, occurredAt }: QrRedirectedEvent): Promise<void> {
    await this.dependencies.repository.incrementRedirectAttempts({
      qrCodeId,
      bucketStart: startOfUtcHour(occurredAt),
    })
  }

  async getQrHourly({
    actor,
    organizationId,
    qrCodeId,
    from,
    to,
  }: {
    actor: QrActor
    organizationId: string | null
    qrCodeId: string
    from: string
    to: string
  }): Promise<QrHourlyAnalyticsResponse> {
    await this.requireQrAccess({ actor, organizationId, qrCodeId })
    const range = this.parseRange({ from, to })
    const records = await this.dependencies.repository.listHourly({
      qrCodeId,
      from: range.fromBucket,
      to: range.toBucket,
    })
    return { items: toHourlyItems(range, records) }
  }

  async getOrganizationHourly({
    actor,
    organizationId,
    from,
    to,
  }: {
    actor: QrActor
    organizationId: string
    from: string
    to: string
  }): Promise<QrHourlyAnalyticsResponse> {
    await this.requireOrganizationAccess({ actor, organizationId })
    const range = this.parseRange({ from, to })
    const records = await this.dependencies.repository.listOrganizationHourly({
      organizationId,
      from: range.fromBucket,
      to: range.toBucket,
    })
    return { items: toHourlyItems(range, records) }
  }

  async fillQrHourly({
    actor,
    slug,
    from,
    to,
    redirectAttempts,
  }: {
    actor: QrActor
    slug: string
    from: string
    to: string
    redirectAttempts: number
  }): Promise<{ slug: string; bucketsFilled: number }> {
    this.requireGlobalAdmin(actor)
    const record = await this.dependencies.qrRepository.findBySlug({ slug })
    if (!record) throw this.notFound()

    const range = this.parseRange({ from, to })
    if (range.toBucket.getTime() - range.fromBucket.getTime() > MAX_FILL_RANGE_MS) {
      throw new AnalyticsDomainError(
        "INVALID_INPUT",
        "Analytics fill range cannot be longer than 30 days.",
      )
    }
    if (
      !Number.isInteger(redirectAttempts) ||
      redirectAttempts < 0 ||
      redirectAttempts > MAX_REDIRECT_ATTEMPTS
    ) {
      throw new AnalyticsDomainError(
        "INVALID_INPUT",
        "Redirect attempts must be a whole number between 0 and 1,000,000.",
      )
    }

    const bucketsFilled = await this.dependencies.repository.fillHourly({
      qrCodeId: record.id,
      from: range.fromBucket,
      to: range.toBucket,
      redirectAttempts,
    })
    return { slug, bucketsFilled }
  }

  async deleteExpired({ actor }: { actor: QrActor }): Promise<{ deletedBuckets: number }> {
    this.requireGlobalAdmin(actor)
    const cutoff = new Date(this.now().getTime() - RETENTION_MS)
    const deletedBuckets = await this.dependencies.repository.deleteOlderThan({ cutoff })
    return { deletedBuckets }
  }

  private async requireQrAccess({
    actor,
    organizationId,
    qrCodeId,
  }: {
    actor: QrActor
    organizationId: string | null
    qrCodeId: string
  }) {
    const isGlobalAdmin = actor.role === "admin"
    if (!isGlobalAdmin) {
      if (!organizationId) throw this.forbidden()
      const role = await this.dependencies.qrRepository.getOrganizationMemberRole({
        organizationId,
        userId: actor.id,
      })
      if (!role || !isOrganizationAdmin(role)) throw this.forbidden()
    }

    const record = await this.dependencies.qrRepository.findById({ id: qrCodeId })
    if (!record) throw this.notFound()
    if (!isGlobalAdmin && record.organizationId !== organizationId) throw this.notFound()
    return record
  }

  private async requireOrganizationAccess({
    actor,
    organizationId,
  }: {
    actor: QrActor
    organizationId: string
  }): Promise<void> {
    if (actor.role === "admin") return
    const role = await this.dependencies.qrRepository.getOrganizationMemberRole({
      organizationId,
      userId: actor.id,
    })
    if (!role || !isOrganizationAdmin(role)) throw this.forbidden()
  }

  private parseRange({ from, to }: { from: string; to: string }) {
    const start = parseUtcTimestamp(from)
    const end = parseUtcTimestamp(to)
    if (!start || !end) {
      throw new AnalyticsDomainError(
        "INVALID_INPUT",
        "Analytics range timestamps must be valid UTC ISO timestamps.",
      )
    }

    const now = this.now()
    const cutoff = new Date(now.getTime() - RETENTION_MS)
    if (start >= end) {
      throw new AnalyticsDomainError("INVALID_INPUT", "Analytics range must have from before to.")
    }
    if (end > now) {
      throw new AnalyticsDomainError(
        "INVALID_INPUT",
        "Analytics range cannot extend into the future.",
      )
    }
    if (end.getTime() - start.getTime() > RETENTION_MS || start < cutoff) {
      throw new AnalyticsDomainError(
        "INVALID_INPUT",
        "Analytics range must be within the last 60 days.",
      )
    }
    if (!isUtcHourBoundary(start) || !isUtcHourBoundary(end)) {
      throw new AnalyticsDomainError(
        "INVALID_INPUT",
        "Analytics range timestamps must be UTC hour boundaries.",
      )
    }

    return {
      fromBucket: start,
      toBucket: end,
    }
  }

  private requireGlobalAdmin(actor: QrActor): void {
    if (actor.role !== "admin") throw this.forbidden()
  }

  private forbidden(): AnalyticsDomainError {
    return new AnalyticsDomainError(
      "FORBIDDEN",
      "Global admin or organization admin access is required.",
    )
  }

  private notFound(): AnalyticsDomainError {
    return new AnalyticsDomainError("NOT_FOUND", "QR code not found.")
  }

  private now(): Date {
    return this.dependencies.clock?.now() ?? new Date()
  }
}

function isOrganizationAdmin(role: string): boolean {
  return role.split(",").some((value) => value.trim() === "owner" || value.trim() === "admin")
}

function parseUtcTimestamp(value: string): Date | null {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|[+-]00:00)$/,
  )
  if (!match) return null

  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null

  const milliseconds = Number((match[7] ?? "").padEnd(3, "0") || 0)
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() + 1 !== Number(match[2]) ||
    date.getUTCDate() !== Number(match[3]) ||
    date.getUTCHours() !== Number(match[4]) ||
    date.getUTCMinutes() !== Number(match[5]) ||
    date.getUTCSeconds() !== Number(match[6]) ||
    date.getUTCMilliseconds() !== milliseconds
  ) {
    return null
  }
  return date
}

function startOfUtcHour(value: Date): Date {
  const bucket = new Date(value)
  bucket.setUTCMinutes(0, 0, 0)
  return bucket
}

function isUtcHourBoundary(value: Date): boolean {
  return (
    value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0 && value.getUTCMilliseconds() === 0
  )
}

function toHourlyItems(
  range: { fromBucket: Date; toBucket: Date },
  records: Array<{ bucketStart: Date; redirectAttempts: number }>,
): QrHourlyAnalyticsResponse["items"] {
  const counts = new Map(
    records.map((record) => [record.bucketStart.getTime(), record.redirectAttempts]),
  )
  const items: QrHourlyAnalyticsResponse["items"] = []
  for (
    let bucket = range.fromBucket.getTime();
    bucket < range.toBucket.getTime();
    bucket += HOUR_MS
  ) {
    items.push({
      hour: new Date(bucket).toISOString(),
      redirectAttempts: counts.get(bucket) ?? 0,
    })
  }
  return items
}
