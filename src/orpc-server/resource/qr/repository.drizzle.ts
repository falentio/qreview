import { and, eq, isNull } from "drizzle-orm"

import { member } from "@/db/auth-schema"
import type { Database } from "@/db/client"
import { qrCodes } from "@/db/schema"
import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import type {
  NewQrRecord,
  QrRecord,
  QrRepository,
  QrTarget,
} from "@/orpc-server/resource/qr/repository"

export class DrizzleQrRepository implements QrRepository {
  constructor(private readonly dependencies: { db: Database }) {}

  async create(input: NewQrRecord): Promise<QrRecord> {
    try {
      const rows = await this.dependencies.db
        .insert(qrCodes)
        .values({
          id: input.id,
          alias: input.alias,
          slug: input.slug,
          rawGoogleMapsUrl: input.target?.rawGoogleMapsUrl ?? null,
          googlePlaceId: input.target?.googlePlaceId ?? null,
          canonicalReviewUrl: input.target?.canonicalReviewUrl ?? null,
          organizationId: input.organizationId,
          createdById: input.createdById,
          claimedById: input.claimedById,
          claimedAt: input.claimedAt,
          claimable: input.claimable,
          createdAt: input.createdAt,
          updatedAt: input.updatedAt,
          deletedAt: input.deletedAt,
        })
        .returning()

      const row = rows[0]
      if (!row) throw new Error("QR code insert returned no row")
      return row
    } catch (error) {
      if (isSlugConflict(error)) {
        throw new QrDomainError("SLUG_CONFLICT", "The generated QR slug already exists.", {
          cause: error,
        })
      }
      throw error
    }
  }

  async findById({ id }: { id: string }): Promise<QrRecord | null> {
    const rows = await this.dependencies.db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.id, id))
      .limit(1)
    return rows[0] ?? null
  }

  async findBySlug({ slug }: { slug: string }): Promise<QrRecord | null> {
    const rows = await this.dependencies.db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.slug, slug))
      .limit(1)
    return rows[0] ?? null
  }

  async listForOrganization({
    organizationId,
    includeArchived,
  }: {
    organizationId: string
    includeArchived: boolean
  }): Promise<QrRecord[]> {
    const conditions = [eq(qrCodes.organizationId, organizationId)]
    if (!includeArchived) conditions.push(isNull(qrCodes.deletedAt))

    return this.dependencies.db
      .select()
      .from(qrCodes)
      .where(and(...conditions))
      .orderBy(qrCodes.createdAt)
  }

  async getOrganizationMemberRole({
    organizationId,
    userId,
  }: {
    organizationId: string
    userId: string
  }): Promise<string | null> {
    const rows = await this.dependencies.db
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
      .limit(1)
    return rows[0]?.role ?? null
  }

  async claimBySlug({
    slug,
    organizationId,
    claimedById,
    claimedAt,
    updatedAt,
  }: {
    slug: string
    organizationId: string
    claimedById: string
    claimedAt: Date
    updatedAt: Date
  }): Promise<QrRecord | null> {
    const rows = await this.dependencies.db
      .update(qrCodes)
      .set({ organizationId, claimedById, claimedAt, claimable: false, updatedAt })
      .where(
        and(
          eq(qrCodes.slug, slug),
          isNull(qrCodes.organizationId),
          isNull(qrCodes.claimedById),
          isNull(qrCodes.claimedAt),
          eq(qrCodes.claimable, true),
          isNull(qrCodes.deletedAt),
        ),
      )
      .returning()
    return rows[0] ?? null
  }

  async updateById({
    id,
    organizationId,
    alias,
    target,
    updatedAt,
  }: {
    id: string
    organizationId: string
    alias?: string
    target?: QrTarget
    updatedAt: Date
  }): Promise<QrRecord | null> {
    const values: Partial<typeof qrCodes.$inferInsert> = { updatedAt }
    if (alias !== undefined) values.alias = alias
    if (target) {
      values.rawGoogleMapsUrl = target.rawGoogleMapsUrl
      values.googlePlaceId = target.googlePlaceId
      values.canonicalReviewUrl = target.canonicalReviewUrl
    }

    const rows = await this.dependencies.db
      .update(qrCodes)
      .set(values)
      .where(
        and(
          eq(qrCodes.id, id),
          eq(qrCodes.organizationId, organizationId),
          isNull(qrCodes.deletedAt),
        ),
      )
      .returning()
    return rows[0] ?? null
  }

  async archiveById({
    id,
    organizationId,
    deletedAt,
    updatedAt,
  }: {
    id: string
    organizationId: string
    deletedAt: Date
    updatedAt: Date
  }): Promise<QrRecord | null> {
    return this.setDeletedAt({ id, organizationId, deletedAt, updatedAt })
  }

  async restoreById({
    id,
    organizationId,
    updatedAt,
  }: {
    id: string
    organizationId: string
    updatedAt: Date
  }): Promise<QrRecord | null> {
    return this.setDeletedAt({ id, organizationId, deletedAt: null, updatedAt })
  }

  private async setDeletedAt({
    id,
    organizationId,
    deletedAt,
    updatedAt,
  }: {
    id: string
    organizationId: string
    deletedAt: Date | null
    updatedAt: Date
  }): Promise<QrRecord | null> {
    const rows = await this.dependencies.db
      .update(qrCodes)
      .set({ deletedAt, updatedAt })
      .where(and(eq(qrCodes.id, id), eq(qrCodes.organizationId, organizationId)))
      .returning()
    return rows[0] ?? null
  }
}

function isSlugConflict(error: unknown, seen = new Set<unknown>()): boolean {
  if (typeof error === "object" && error !== null) {
    if (seen.has(error)) return false
    seen.add(error)
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  if (
    message.includes("qr_codes.slug") ||
    message.includes("unique constraint failed: qr_codes.slug") ||
    message.includes("slug_unique")
  ) {
    return true
  }

  if (typeof error === "object" && error !== null && "cause" in error) {
    return isSlugConflict(error.cause, seen)
  }

  return false
}
