import type { PlacesAdapter, PlaceCandidate } from "@/orpc-server/resource/qr/places"
import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import {
  createQrPublicProjection,
  isQrReady,
  type QrPublicProjection,
  type QrPublicProjectionStore,
} from "@/orpc-server/resource/qr/public-cache"
import {
  isGoogleCanonicalReviewUrlForPlace,
  isGooglePlaceId,
  resolveGoogleMapsUrl,
} from "@/orpc-server/resource/qr/url"
import type {
  NewQrRecord,
  QrRecord,
  QrRepository,
  QrTarget,
} from "@/orpc-server/resource/qr/repository"

export type QrActor = {
  id: string
  role?: string | null
}

export type QrResponse = {
  id: string
  alias: string
  slug: string
  claimable: boolean
  ownershipState: "orphan" | "not-orphan"
  configurationState: "incomplete" | "active"
  rawGoogleMapsUrl: string | null
  googlePlaceId: string | null
  canonicalReviewUrl: string | null
  organizationId: string | null
  createdById: string
  claimedById: string | null
  claimedAt: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type QrResolveResponse = { candidates: PlaceCandidate[] }

export type PublicQrResponse =
  | { kind: "setup" }
  | { kind: "expired" }
  | { kind: "redirect"; canonicalReviewUrl: string; qrCodeId: string }

export class QrService {
  constructor(
    private readonly dependencies: {
      repository: Pick<
        QrRepository,
        | "create"
        | "updateMapBySlug"
        | "findById"
        | "findBySlug"
        | "listForOrganization"
        | "getOrganizationMemberRole"
        | "claimBySlug"
        | "updateById"
        | "archiveById"
        | "restoreById"
        | "setExpirationBySlug"
      >
      places: PlacesAdapter
      publicProjection?: QrPublicProjectionStore
      fetcher?: typeof fetch
      clock?: { now(): Date }
      ids: { generateId(): string; generateSlug(): string }
    },
  ) {}

  async resolve({
    actor,
    organizationId,
    googleMapsUrl,
  }: {
    actor: QrActor
    organizationId: string
    googleMapsUrl: string
  }): Promise<QrResolveResponse> {
    await this.requireMember({ actor, organizationId })
    return this.resolvePlaceCandidates(googleMapsUrl)
  }

  async resolvePlace({
    actor,
    googleMapsUrl,
  }: {
    actor: QrActor
    googleMapsUrl: string
  }): Promise<QrResolveResponse> {
    this.requireGlobalAdmin(actor)
    return this.resolvePlaceCandidates(googleMapsUrl)
  }

  private async resolvePlaceCandidates(googleMapsUrl: string): Promise<QrResolveResponse> {
    const parsed = await resolveGoogleMapsUrl(googleMapsUrl, this.dependencies.fetcher)

    if (parsed.placeId) {
      const details = await this.dependencies.places.getPlaceDetails({ placeId: parsed.placeId })
      return { candidates: [toCandidate(details)] }
    }

    if (!parsed.query) {
      throw new QrDomainError("INVALID_GOOGLE_MAPS_URL", "The Google Maps URL has no place query.")
    }

    const candidates = await this.dependencies.places.search({ query: parsed.query })
    if (candidates.length === 0) {
      throw new QrDomainError(
        "PLACE_RESOLUTION_FAILED",
        "Google Places found no matching location.",
      )
    }
    return { candidates: candidates.slice(0, 5).map(toCandidate) }
  }

  async create({
    actor,
    organizationId,
    alias,
    googleMapsUrl,
    googlePlaceId,
  }: {
    actor: QrActor
    organizationId: string
    alias: string
    googleMapsUrl: string
    googlePlaceId: string
  }): Promise<QrResponse> {
    await this.requireMember({ actor, organizationId })
    const normalizedAlias = normalizeAlias(alias)
    const target = await this.resolveTarget({ googleMapsUrl, googlePlaceId })
    return this.createRecord({
      alias: normalizedAlias,
      organizationId,
      createdById: actor.id,
      target,
    })
  }

  async batchCreate({
    actor,
    organizationId,
    alias,
    googleMapsUrl,
    googlePlaceId,
    count,
    expiresAt,
  }: {
    actor: QrActor
    organizationId: string
    alias: string
    googleMapsUrl: string
    googlePlaceId: string
    count: number
    expiresAt?: string | null
  }): Promise<{ items: QrResponse[] }> {
    this.requireGlobalAdmin(actor)
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      throw new QrDomainError("INVALID_INPUT", "QR batch count must be between 1 and 100.")
    }

    const normalizedAlias = normalizeAlias(alias)
    const normalizedExpiresAt = parseExpiration(expiresAt)
    const target = await this.resolveTarget({ googleMapsUrl, googlePlaceId })
    const items: QrResponse[] = []
    for (let index = 0; index < count; index += 1) {
      items.push(
        await this.createRecord({
          alias: normalizedAlias,
          organizationId,
          createdById: actor.id,
          target,
          expiresAt: normalizedExpiresAt,
        }),
      )
    }
    return { items }
  }

  async batchCreateOrphan({
    actor,
    alias,
    googleMapsUrl,
    googlePlaceId,
    count,
    expiresAt,
  }: {
    actor: QrActor
    alias: string
    googleMapsUrl: string
    googlePlaceId: string
    count: number
    expiresAt?: string | null
  }): Promise<{ items: QrResponse[] }> {
    this.requireGlobalAdmin(actor)
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      throw new QrDomainError("INVALID_INPUT", "QR batch count must be between 1 and 100.")
    }

    const normalizedAlias = normalizeAlias(alias)
    const normalizedExpiresAt = parseExpiration(expiresAt)
    const target = await this.resolveTarget({ googleMapsUrl, googlePlaceId })
    const items: QrResponse[] = []
    for (let index = 0; index < count; index += 1) {
      items.push(
        await this.createRecord({
          alias: normalizedAlias,
          organizationId: null,
          createdById: actor.id,
          target,
          expiresAt: normalizedExpiresAt,
        }),
      )
    }
    return { items }
  }

  async createOrphan({
    actor,
    alias,
    googleMapsUrl,
    googlePlaceId,
    expiresAt,
  }: {
    actor: QrActor
    alias: string
    googleMapsUrl?: string
    googlePlaceId?: string
    expiresAt?: string | null
  }): Promise<QrResponse> {
    this.requireGlobalAdmin(actor)
    const normalizedAlias = normalizeAlias(alias)
    const normalizedExpiresAt = parseExpiration(expiresAt)
    const target = await this.resolveOptionalTarget({ googleMapsUrl, googlePlaceId })
    return this.createRecord({
      alias: normalizedAlias,
      organizationId: null,
      createdById: actor.id,
      target,
      expiresAt: normalizedExpiresAt,
    })
  }

  async claim({
    actor,
    slug,
    organizationId,
  }: {
    actor: QrActor
    slug: string
    organizationId: string
  }): Promise<QrResponse> {
    await this.requireOrganizationAdmin({ actor, organizationId })
    const existing = await this.dependencies.repository.findBySlug({ slug })
    if (!existing) throw this.notFound()
    if (existing.deletedAt)
      throw new QrDomainError("ARCHIVED", "Archived QR codes cannot be claimed.")
    if (
      !existing.claimable ||
      existing.organizationId ||
      existing.claimedById ||
      existing.claimedAt
    ) {
      throw new QrDomainError("CONFLICT", "This QR code has already been claimed.")
    }

    const now = this.now()
    const claimed = await this.dependencies.repository.claimBySlug({
      slug,
      organizationId,
      claimedById: actor.id,
      claimedAt: now,
      updatedAt: now,
    })
    if (!claimed) throw new QrDomainError("CONFLICT", "This QR code has already been claimed.")
    return toResponse(claimed)
  }

  async list({
    actor,
    organizationId,
    includeArchived = false,
  }: {
    actor: QrActor
    organizationId: string
    includeArchived?: boolean
  }): Promise<{ items: QrResponse[] }> {
    await this.requireOrganizationAdmin({ actor, organizationId })
    const items = await this.dependencies.repository.listForOrganization({
      organizationId,
      includeArchived,
    })
    return { items: items.map(toResponse) }
  }

  async get({
    actor,
    organizationId,
    id,
    slug,
  }: {
    actor: QrActor
    organizationId: string
    id?: string
    slug?: string
  }): Promise<QrResponse> {
    await this.requireOrganizationAdmin({ actor, organizationId })
    if ((id === undefined) === (slug === undefined)) {
      throw new QrDomainError("INVALID_INPUT", "Provide exactly one QR id or slug.")
    }

    const record =
      id !== undefined
        ? await this.dependencies.repository.findById({ id })
        : await this.dependencies.repository.findBySlug({ slug: slug as string })
    if (!record) throw this.notFound()

    if (record.organizationId !== organizationId) throw this.notFound()
    return toResponse(record)
  }

  async verifyBySlug({
    actor,
    slug,
  }: {
    actor: QrActor
    slug: string
  }): Promise<Pick<QrResponse, "slug" | "expiresAt">> {
    this.requireGlobalAdmin(actor)
    const record = await this.dependencies.repository.findBySlug({ slug })
    if (!record || record.deletedAt) throw this.notFound()
    return { slug: record.slug, expiresAt: record.expiresAt?.toISOString() ?? null }
  }

  async setExpirationBySlug({
    actor,
    slug,
    expiresAt,
  }: {
    actor: QrActor
    slug: string
    expiresAt: string | null
  }): Promise<QrResponse> {
    this.requireGlobalAdmin(actor)
    const normalizedExpiresAt = parseExpiration(expiresAt)
    const existing = await this.dependencies.repository.findBySlug({ slug })
    if (!existing) throw this.notFound()
    if (existing.deletedAt)
      throw new QrDomainError("ARCHIVED", "Archived QR codes must be restored first.")

    const updatedAt = this.now()
    const projectedRecord = {
      ...existing,
      expiresAt: normalizedExpiresAt,
      updatedAt,
    }
    const publicationWasAwaited = await this.publishPublicProjectionAndWait(
      createQrPublicProjection(projectedRecord),
    )

    let updated: QrRecord | null
    try {
      updated = await this.dependencies.repository.setExpirationBySlug({
        slug,
        expiresAt: normalizedExpiresAt,
        updatedAt,
      })
    } catch (error) {
      if (publicationWasAwaited) {
        await this.restorePublicProjection(existing)
      }
      throw error
    }
    if (!updated) {
      if (publicationWasAwaited) {
        await this.restorePublicProjection(existing)
      }
      throw this.notFound()
    }
    if (!publicationWasAwaited) this.publishPublicProjection(createQrPublicProjection(updated))
    return toResponse(updated)
  }

  async update({
    actor,
    organizationId,
    id,
    alias,
    googleMapsUrl,
    googlePlaceId,
  }: {
    actor: QrActor
    organizationId: string
    id: string
    alias?: string
    googleMapsUrl?: string
    googlePlaceId?: string
  }): Promise<QrResponse> {
    await this.requireOrganizationAdmin({ actor, organizationId })
    if (alias === undefined && googleMapsUrl === undefined && googlePlaceId === undefined) {
      throw new QrDomainError("INVALID_INPUT", "The QR code update is empty.")
    }

    const existing = await this.dependencies.repository.findById({ id })
    if (!existing || existing.organizationId !== organizationId) throw this.notFound()
    if (existing.deletedAt)
      throw new QrDomainError("ARCHIVED", "Archived QR codes must be restored first.")

    const target = await this.resolveOptionalTarget({ googleMapsUrl, googlePlaceId })
    const updated = await this.dependencies.repository.updateById({
      id,
      organizationId,
      alias: alias === undefined ? undefined : normalizeAlias(alias),
      target,
      updatedAt: this.now(),
    })
    if (!updated) throw this.notFound()
    this.publishPublicProjection(createQrPublicProjection(updated))
    return toResponse(updated)
  }

  async updateMapBySlug({
    actor,
    slug,
    googleMapsUrl,
    googlePlaceId,
  }: {
    actor: QrActor
    slug: string
    googleMapsUrl: string
    googlePlaceId: string
  }): Promise<QrResponse> {
    this.requireGlobalAdmin(actor)
    const existing = await this.dependencies.repository.findBySlug({ slug })
    if (!existing) throw this.notFound()
    if (existing.deletedAt)
      throw new QrDomainError("ARCHIVED", "Archived QR codes must be restored first.")

    const target = await this.resolveTarget({ googleMapsUrl, googlePlaceId })
    const updated = await this.dependencies.repository.updateMapBySlug({
      slug,
      target,
      updatedAt: this.now(),
    })
    if (!updated) throw this.notFound()
    this.publishPublicProjection(createQrPublicProjection(updated))
    return toResponse(updated)
  }

  async archive({
    actor,
    organizationId,
    id,
  }: {
    actor: QrActor
    organizationId: string
    id: string
  }): Promise<QrResponse> {
    await this.requireOrganizationAdmin({ actor, organizationId })
    await this.requireOwnedRecord({ id, organizationId })
    const now = this.now()
    const archived = await this.dependencies.repository.archiveById({
      id,
      organizationId,
      deletedAt: now,
      updatedAt: now,
    })
    if (!archived) throw this.notFound()
    this.publishPublicProjection(createQrPublicProjection(archived))
    return toResponse(archived)
  }

  async restore({
    actor,
    organizationId,
    id,
  }: {
    actor: QrActor
    organizationId: string
    id: string
  }): Promise<QrResponse> {
    await this.requireOrganizationAdmin({ actor, organizationId })
    await this.requireOwnedRecord({ id, organizationId })
    const restored = await this.dependencies.repository.restoreById({
      id,
      organizationId,
      updatedAt: this.now(),
    })
    if (!restored) throw this.notFound()
    this.publishPublicProjection(createQrPublicProjection(restored))
    return toResponse(restored)
  }

  async resolvePublic({ slug }: { slug: string }): Promise<PublicQrResponse> {
    const cached = await this.dependencies.publicProjection?.get({ slug })
    if (cached) return this.resolvePublicProjection(cached)

    let record: QrRecord | null
    try {
      record = await this.dependencies.repository.findBySlug({ slug })
    } catch (error) {
      throw new QrDomainError("PUBLIC_UNAVAILABLE", "QR redirects are temporarily unavailable.", {
        cause: error,
      })
    }

    if (!record) throw this.notFound()

    const projection = createQrPublicProjection(record)
    this.publishPublicProjection(projection)
    return this.resolvePublicProjection(projection)
  }

  private async createRecord({
    alias,
    organizationId,
    createdById,
    target,
    expiresAt,
  }: {
    alias: string
    organizationId: string | null
    createdById: string
    target?: QrTarget
    expiresAt?: Date | null
  }): Promise<QrResponse> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const now = this.now()
      const input: NewQrRecord = {
        id: this.dependencies.ids.generateId(),
        alias,
        slug: this.dependencies.ids.generateSlug(),
        organizationId,
        createdById,
        claimedById: null,
        claimedAt: null,
        claimable: organizationId === null,
        expiresAt: expiresAt ?? null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        target,
      }
      try {
        const created = await this.dependencies.repository.create(input)
        this.publishPublicProjection(createQrPublicProjection(created))
        return toResponse(created)
      } catch (error) {
        if (!(error instanceof QrDomainError) || error.code !== "SLUG_CONFLICT" || attempt === 4) {
          throw error
        }
      }
    }
    throw new QrDomainError("SLUG_CONFLICT", "Could not generate a unique QR slug.")
  }

  private async resolveOptionalTarget({
    googleMapsUrl,
    googlePlaceId,
  }: {
    googleMapsUrl?: string
    googlePlaceId?: string
  }): Promise<QrTarget | undefined> {
    if (googleMapsUrl === undefined && googlePlaceId === undefined) return undefined
    if (!googleMapsUrl || !googlePlaceId) {
      throw new QrDomainError(
        "INVALID_INPUT",
        "Google Maps URL and Google Place ID must be supplied together.",
      )
    }
    return this.resolveTarget({ googleMapsUrl, googlePlaceId })
  }

  private async resolveTarget({
    googleMapsUrl,
    googlePlaceId,
  }: {
    googleMapsUrl: string
    googlePlaceId: string
  }): Promise<QrTarget> {
    if (!isGooglePlaceId(googlePlaceId)) {
      throw new QrDomainError("PLACE_RESOLUTION_FAILED", "The Google Place ID is invalid.")
    }
    const parsed = await resolveGoogleMapsUrl(googleMapsUrl, this.dependencies.fetcher)
    if (parsed.placeId && parsed.placeId !== googlePlaceId) {
      throw new QrDomainError(
        "PLACE_RESOLUTION_FAILED",
        "The selected place does not match the Google Maps URL.",
      )
    }

    if (!parsed.placeId) {
      if (!parsed.query) {
        throw new QrDomainError(
          "PLACE_RESOLUTION_FAILED",
          "The Google Maps URL has no place query.",
        )
      }
      const candidates = await this.dependencies.places.search({ query: parsed.query })
      if (!candidates.some((candidate) => candidate.placeId === googlePlaceId)) {
        throw new QrDomainError(
          "PLACE_RESOLUTION_FAILED",
          "The selected place was not found for that Google Maps URL.",
        )
      }
    }

    const details = await this.dependencies.places.getPlaceDetails({ placeId: googlePlaceId })
    if (!isGoogleCanonicalReviewUrlForPlace(details.canonicalReviewUrl, googlePlaceId)) {
      throw new QrDomainError(
        "PLACE_RESOLUTION_FAILED",
        "Google Places returned no canonical review URL for that location.",
      )
    }
    return {
      rawGoogleMapsUrl: parsed.rawUrl,
      googlePlaceId,
      canonicalReviewUrl: details.canonicalReviewUrl,
    }
  }

  private async requireMember({
    actor,
    organizationId,
  }: {
    actor: QrActor
    organizationId: string
  }) {
    const role = await this.dependencies.repository.getOrganizationMemberRole({
      organizationId,
      userId: actor.id,
    })
    if (!role) throw new QrDomainError("FORBIDDEN", "You are not a member of this organization.")
    return role
  }

  private async requireOrganizationAdmin({
    actor,
    organizationId,
  }: {
    actor: QrActor
    organizationId: string
  }) {
    const role = await this.requireMember({ actor, organizationId })
    if (!role.split(",").some((value) => value.trim() === "owner" || value.trim() === "admin")) {
      throw new QrDomainError("FORBIDDEN", "Organization owner or admin access is required.")
    }
  }

  private requireGlobalAdmin(actor: QrActor): void {
    if (actor.role !== "admin") {
      throw new QrDomainError("FORBIDDEN", "Global Better Auth admin access is required.")
    }
  }

  private async requireOwnedRecord({ id, organizationId }: { id: string; organizationId: string }) {
    const record = await this.dependencies.repository.findById({ id })
    if (!record || record.organizationId !== organizationId) throw this.notFound()
    return record
  }

  private resolvePublicProjection(projection: QrPublicProjection): PublicQrResponse {
    if (projection.state === "archived") throw this.notFound()
    if (projection.expiresAt && this.now() >= new Date(projection.expiresAt)) {
      return { kind: "expired" }
    }
    if (projection.state === "active") {
      return {
        kind: "redirect",
        canonicalReviewUrl: projection.canonicalReviewUrl,
        qrCodeId: projection.qrCodeId,
      }
    }
    return { kind: "setup" }
  }

  private publishPublicProjection(projection: QrPublicProjection): void {
    try {
      this.dependencies.publicProjection?.set(projection)
    } catch (error) {
      console.warn("QR public projection publication failed.", {
        slug: projection.slug,
        error,
      })
    }
  }

  private async publishPublicProjectionAndWait(projection: QrPublicProjection): Promise<boolean> {
    const publicProjection = this.dependencies.publicProjection
    if (!publicProjection?.setAndWait) return false
    await publicProjection.setAndWait(projection)
    return true
  }

  private async restorePublicProjection(record: QrRecord): Promise<void> {
    const projection = createQrPublicProjection(record)
    const publicProjection = this.dependencies.publicProjection
    if (!publicProjection?.setAndWait) {
      this.publishPublicProjection(projection)
      return
    }

    try {
      await publicProjection.setAndWait(projection)
    } catch (error) {
      console.warn("QR public projection restoration failed.", {
        slug: projection.slug,
        error,
      })
    }
  }

  private now(): Date {
    return this.dependencies.clock?.now() ?? new Date()
  }

  private notFound(): QrDomainError {
    return new QrDomainError("NOT_FOUND", "QR code not found.")
  }
}

function normalizeAlias(value: string): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > 120) {
    throw new QrDomainError("INVALID_INPUT", "Alias must be between 1 and 120 characters.")
  }
  return normalized
}

function toResponse(record: QrRecord): QrResponse {
  return {
    id: record.id,
    alias: record.alias,
    slug: record.slug,
    claimable: record.claimable,
    ownershipState: record.organizationId ? "not-orphan" : "orphan",
    configurationState: isQrReady(record) ? "active" : "incomplete",
    rawGoogleMapsUrl: record.rawGoogleMapsUrl,
    googlePlaceId: record.googlePlaceId,
    canonicalReviewUrl: record.canonicalReviewUrl,
    organizationId: record.organizationId,
    createdById: record.createdById,
    claimedById: record.claimedById,
    claimedAt: record.claimedAt?.toISOString() ?? null,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt?.toISOString() ?? null,
  }
}

function parseExpiration(value: string | null | undefined): Date | null {
  if (value === undefined || value === null) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const dateOnly = new Date(`${value}T00:00:00.000Z`)
    if (Number.isNaN(dateOnly.getTime()) || dateOnly.toISOString().slice(0, 10) !== value) {
      throw new QrDomainError("INVALID_INPUT", "Expiry date must be a valid ISO date.")
    }
    dateOnly.setUTCDate(dateOnly.getUTCDate() + 1)
    return dateOnly
  }

  if (!/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(value)) {
    throw new QrDomainError("INVALID_INPUT", "Expiry date must be a UTC calendar date.")
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new QrDomainError("INVALID_INPUT", "Expiry date must be a valid ISO date.")
  }
  return parsed
}

function toCandidate(place: PlaceCandidate): PlaceCandidate {
  return { placeId: place.placeId, name: place.name, address: place.address }
}
