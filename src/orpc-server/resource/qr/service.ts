import type { AppLogger } from "@/lib/logging"
import { DependencyUnavailableError } from "@/orpc-server/errors"
import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import {
  createQrPublicProjection,
  isQrReady,
  type QrPublicProjection,
  type QrPublicProjectionStore,
} from "@/orpc-server/resource/qr/public-cache"
import {
  createGoogleCanonicalReviewUrl,
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

export type PlaceCandidate = {
  placeId: string
  name: string
  address: string | null
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
      publicProjection?: QrPublicProjectionStore
      fetcher?: typeof fetch
      clock?: { now(): Date }
      ids: { generateId(): string; generateSlug(): string }
      logger?: Pick<AppLogger, "warn">
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
    const parsed = await this.resolveLocalGoogleMapsUrl(googleMapsUrl)
    if (!parsed.placeId || !parsed.featureId) {
      throw new QrDomainError(
        "PLACE_RESOLUTION_FAILED",
        "URL Google Maps harus mengidentifikasi tempat secara langsung.",
      )
    }

    return {
      candidates: [
        {
          placeId: parsed.placeId,
          name: parsed.query ?? "Google Maps place",
          address: null,
        },
      ],
    }
  }

  private resolveLocalGoogleMapsUrl(googleMapsUrl: string) {
    return resolveGoogleMapsUrl(googleMapsUrl, this.dependencies.fetcher, this.dependencies.logger)
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
      throw new QrDomainError("INVALID_INPUT", "Jumlah batch QR harus antara 1 dan 100.")
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
    googleMapsUrl?: string
    googlePlaceId?: string
    count: number
    expiresAt?: string | null
  }): Promise<{ items: QrResponse[] }> {
    this.requireGlobalAdmin(actor)
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      throw new QrDomainError("INVALID_INPUT", "Jumlah batch QR harus antara 1 dan 100.")
    }

    const normalizedAlias = normalizeAlias(alias)
    const normalizedExpiresAt = parseExpiration(expiresAt)
    const target = await this.resolveOptionalTarget({ googleMapsUrl, googlePlaceId })
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
      throw new QrDomainError("ARCHIVED", "Kode QR yang diarsipkan tidak dapat diklaim.")
    if (
      !existing.claimable ||
      existing.organizationId ||
      existing.claimedById ||
      existing.claimedAt
    ) {
      throw new QrDomainError("CONFLICT", "Kode QR ini sudah diklaim.")
    }

    const now = this.now()
    const claimed = await this.dependencies.repository.claimBySlug({
      slug,
      organizationId,
      claimedById: actor.id,
      claimedAt: now,
      updatedAt: now,
    })
    if (!claimed) throw new QrDomainError("CONFLICT", "Kode QR ini sudah diklaim.")
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
      throw new QrDomainError("INVALID_INPUT", "Berikan tepat satu ID atau slug QR.")
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
      throw new QrDomainError(
        "ARCHIVED",
        "Kode QR yang diarsipkan harus dipulihkan terlebih dahulu.",
      )

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
      throw new QrDomainError("INVALID_INPUT", "Pembaruan kode QR kosong.")
    }

    const existing = await this.dependencies.repository.findById({ id })
    if (!existing || existing.organizationId !== organizationId) throw this.notFound()
    if (existing.deletedAt)
      throw new QrDomainError(
        "ARCHIVED",
        "Kode QR yang diarsipkan harus dipulihkan terlebih dahulu.",
      )

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
      throw new QrDomainError(
        "ARCHIVED",
        "Kode QR yang diarsipkan harus dipulihkan terlebih dahulu.",
      )

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
    let cached: QrPublicProjection | null = null
    try {
      cached = (await this.dependencies.publicProjection?.get({ slug })) ?? null
    } catch (error) {
      this.dependencies.logger?.warn("QR public projection read failed.", { slug, error })
    }
    if (cached) return this.resolvePublicProjection(cached)

    let record: QrRecord | null
    try {
      record = await this.dependencies.repository.findBySlug({ slug })
    } catch (error) {
      throw new QrDomainError(
        "PUBLIC_UNAVAILABLE",
        "Pengalihan QR tidak tersedia untuk sementara.",
        {
          cause: error,
        },
      )
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
    throw new QrDomainError("SLUG_CONFLICT", "Slug QR unik tidak dapat dibuat.")
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
        "URL Google Maps dan ID Tempat Google harus diberikan bersama.",
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
      throw new QrDomainError("PLACE_RESOLUTION_FAILED", "ID Tempat Google tidak valid.")
    }
    const parsed = await this.resolveLocalGoogleMapsUrl(googleMapsUrl)
    if (parsed.placeId && parsed.placeId !== googlePlaceId) {
      throw new QrDomainError(
        "PLACE_RESOLUTION_FAILED",
        "Tempat yang dipilih tidak sesuai dengan URL Google Maps.",
      )
    }

    if (parsed.placeId !== googlePlaceId || !parsed.featureId) {
      throw new QrDomainError(
        "PLACE_RESOLUTION_FAILED",
        "URL Google Maps tidak memiliki identitas tempat yang dapat digunakan.",
      )
    }
    const canonicalReviewUrl = createGoogleCanonicalReviewUrl({
      placeId: googlePlaceId,
      featureId: parsed.featureId,
    })
    if (
      !canonicalReviewUrl ||
      !isGoogleCanonicalReviewUrlForPlace(canonicalReviewUrl, googlePlaceId)
    ) {
      throw new QrDomainError(
        "PLACE_RESOLUTION_FAILED",
        "ID tempat Google tidak dapat dikonversi menjadi URL ulasan kanonis.",
      )
    }

    return {
      rawGoogleMapsUrl: parsed.rawUrl,
      googlePlaceId,
      canonicalReviewUrl,
    }
  }

  private async requireMember({
    actor,
    organizationId,
  }: {
    actor: QrActor
    organizationId: string
  }) {
    let role: string | null
    try {
      role = await this.dependencies.repository.getOrganizationMemberRole({
        organizationId,
        userId: actor.id,
      })
    } catch (error) {
      throw new DependencyUnavailableError(
        "ORGANIZATION_UNAVAILABLE",
        "Layanan organisasi tidak tersedia untuk sementara.",
        { cause: error },
      )
    }

    if (!role) throw new QrDomainError("FORBIDDEN", "Anda bukan anggota organisasi ini.")
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
      throw new QrDomainError("FORBIDDEN", "Akses pemilik atau admin organisasi diperlukan.")
    }
  }

  private requireGlobalAdmin(actor: QrActor): void {
    if (actor.role !== "admin") {
      throw new QrDomainError("FORBIDDEN", "Akses admin global Better Auth diperlukan.")
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
      this.dependencies.logger?.warn("QR public projection publication failed.", {
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
      this.dependencies.logger?.warn("QR public projection restoration failed.", {
        slug: projection.slug,
        error,
      })
    }
  }

  private now(): Date {
    return this.dependencies.clock?.now() ?? new Date()
  }

  private notFound(): QrDomainError {
    return new QrDomainError("NOT_FOUND", "Kode QR tidak ditemukan.")
  }
}

function normalizeAlias(value: string): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > 120) {
    throw new QrDomainError("INVALID_INPUT", "Alias harus antara 1 dan 120 karakter.")
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
      throw new QrDomainError(
        "INVALID_INPUT",
        "Tanggal kedaluwarsa harus berupa tanggal ISO yang valid.",
      )
    }
    dateOnly.setUTCDate(dateOnly.getUTCDate() + 1)
    return dateOnly
  }

  if (!/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(value)) {
    throw new QrDomainError(
      "INVALID_INPUT",
      "Tanggal kedaluwarsa harus berupa tanggal kalender UTC.",
    )
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new QrDomainError(
      "INVALID_INPUT",
      "Tanggal kedaluwarsa harus berupa tanggal ISO yang valid.",
    )
  }
  return parsed
}
