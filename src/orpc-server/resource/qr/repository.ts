import { qrCodes } from "@/db/schema"

export type QrRecord = typeof qrCodes.$inferSelect

export type QrTarget = {
  rawGoogleMapsUrl: string
  googlePlaceId: string
  canonicalReviewUrl: string
}

export type NewQrRecord = Omit<
  QrRecord,
  "rawGoogleMapsUrl" | "googlePlaceId" | "canonicalReviewUrl"
> & {
  target?: QrTarget
}

export interface QrRepository {
  create(input: NewQrRecord): Promise<QrRecord>
  findById({ id }: { id: string }): Promise<QrRecord | null>
  findBySlug({ slug }: { slug: string }): Promise<QrRecord | null>
  listForOrganization({
    organizationId,
    includeArchived,
  }: {
    organizationId: string
    includeArchived: boolean
  }): Promise<QrRecord[]>
  getOrganizationMemberRole({
    organizationId,
    userId,
  }: {
    organizationId: string
    userId: string
  }): Promise<string | null>
  claimBySlug({
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
  }): Promise<QrRecord | null>
  updateById({
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
  }): Promise<QrRecord | null>
  updateMapBySlug({
    slug,
    target,
    updatedAt,
  }: {
    slug: string
    target: QrTarget
    updatedAt: Date
  }): Promise<QrRecord | null>
  archiveById({
    id,
    organizationId,
    deletedAt,
    updatedAt,
  }: {
    id: string
    organizationId: string
    deletedAt: Date
    updatedAt: Date
  }): Promise<QrRecord | null>
  restoreById({
    id,
    organizationId,
    updatedAt,
  }: {
    id: string
    organizationId: string
    updatedAt: Date
  }): Promise<QrRecord | null>
}
