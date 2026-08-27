import type { PlacesAdapter, PlaceCandidate } from "@/orpc-server/resource/qr/places"
import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import { parseGoogleMapsUrl } from "@/orpc-server/resource/qr/url"
import { generateQrId, generateQrSlug } from "@/orpc-server/resource/qr/random"
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
  ownershipState: "orphan" | "not-orphan"
  configurationState: "incomplete" | "active"
  rawGoogleMapsUrl: string | null
  googlePlaceId: string | null
  canonicalReviewUrl: string | null
  organizationId: string | null
  createdById: string
  claimedById: string | null
  claimedAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type QrResolveResponse = { candidates: PlaceCandidate[] }

export type PublicQrResponse = { kind: "setup" } | { kind: "redirect"; canonicalReviewUrl: string }

export class QrService {
  constructor(
    private readonly dependencies: {
      repository: Pick<
        QrRepository,
        | "create"
        | "findById"
        | "findBySlug"
        | "listForOrganization"
        | "getOrganizationMemberRole"
        | "claimBySlug"
        | "updateById"
        | "archiveById"
        | "restoreById"
      >
      places: PlacesAdapter
      clock?: { now(): Date }
      ids?: { generateId(): string; generateSlug(): string }
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
    const parsed = parseGoogleMapsUrl(googleMapsUrl)

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

  async createOrphan({
    actor,
    alias,
    googleMapsUrl,
    googlePlaceId,
  }: {
    actor: QrActor
    alias: string
    googleMapsUrl?: string
    googlePlaceId?: string
  }): Promise<QrResponse> {
    this.requireGlobalAdmin(actor)
    const normalizedAlias = normalizeAlias(alias)
    const target = await this.resolveOptionalTarget({ googleMapsUrl, googlePlaceId })
    return this.createRecord({
      alias: normalizedAlias,
      organizationId: null,
      createdById: actor.id,
      target,
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
    if (existing.organizationId) {
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

    const record = id
      ? await this.dependencies.repository.findById({ id })
      : await this.dependencies.repository.findBySlug({ slug: slug as string })
    if (!record) throw this.notFound()

    const canRead =
      record.organizationId === organizationId || (slug !== undefined && !record.organizationId)
    if (!canRead) throw this.notFound()
    return toResponse(record)
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
    return toResponse(restored)
  }

  async resolvePublic({ slug }: { slug: string }): Promise<PublicQrResponse> {
    const record = await this.dependencies.repository.findBySlug({ slug })
    if (!record || record.deletedAt) throw this.notFound()
    if (!record.organizationId || !record.googlePlaceId || !record.canonicalReviewUrl) {
      return { kind: "setup" }
    }
    return { kind: "redirect", canonicalReviewUrl: record.canonicalReviewUrl }
  }

  private async createRecord({
    alias,
    organizationId,
    createdById,
    target,
  }: {
    alias: string
    organizationId: string | null
    createdById: string
    target?: QrTarget
  }): Promise<QrResponse> {
    const ids = this.dependencies.ids ?? { generateId: generateQrId, generateSlug: generateQrSlug }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const now = this.now()
      const input: NewQrRecord = {
        id: ids.generateId(),
        alias,
        slug: ids.generateSlug(),
        organizationId,
        createdById,
        claimedById: null,
        claimedAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        target,
      }
      try {
        return toResponse(await this.dependencies.repository.create(input))
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
    if (!/^[A-Za-z0-9_-]{10,}$/.test(googlePlaceId)) {
      throw new QrDomainError("PLACE_RESOLUTION_FAILED", "The Google Place ID is invalid.")
    }
    const parsed = parseGoogleMapsUrl(googleMapsUrl)
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
    if (role !== "owner" && role !== "admin") {
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
    ownershipState: record.organizationId ? "not-orphan" : "orphan",
    configurationState: record.googlePlaceId && record.canonicalReviewUrl ? "active" : "incomplete",
    rawGoogleMapsUrl: record.rawGoogleMapsUrl,
    googlePlaceId: record.googlePlaceId,
    canonicalReviewUrl: record.canonicalReviewUrl,
    organizationId: record.organizationId,
    createdById: record.createdById,
    claimedById: record.claimedById,
    claimedAt: record.claimedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt?.toISOString() ?? null,
  }
}

function toCandidate(place: PlaceCandidate): PlaceCandidate {
  return { placeId: place.placeId, name: place.name, address: place.address }
}
