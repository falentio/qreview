import { member, organization, user } from "@/db/auth-schema"
import { createDb } from "@/db/client"
import { DrizzleQrAnalyticsRepository } from "@/orpc-server/resource/analytics/repository.drizzle"
import type { NewQrRecord } from "@/orpc-server/resource/qr/repository"
import { DrizzleQrRepository } from "@/orpc-server/resource/qr/repository.drizzle"
import { env } from "cloudflare:workers"

export const db = createDb(env.DB)
export const repository = new DrizzleQrRepository({ db })
export const analyticsRepository = new DrizzleQrAnalyticsRepository({ db })
export const timestamp = new Date("2030-01-01T00:00:00.000Z")

export async function clearTestData() {
  await env.DB.prepare("DELETE FROM qr_analytics_hourly WHERE qr_code_id LIKE ?")
    .bind("repo-test-%")
    .run()
  await env.DB.prepare("DELETE FROM qr_codes WHERE id LIKE ?").bind("repo-test-%").run()
  await env.DB.prepare("DELETE FROM member WHERE id LIKE ?").bind("repo-test-%").run()
  await env.DB.prepare("DELETE FROM organization WHERE id LIKE ?").bind("repo-test-%").run()
  await env.DB.prepare("DELETE FROM user WHERE id LIKE ?").bind("repo-test-%").run()
}

export async function createOrganization({
  id,
  userId,
  role = "owner",
}: {
  id: string
  userId: string
  role?: string
}) {
  await db
    .insert(user)
    .values({
      id: userId,
      name: "Repository Test User",
      email: `${userId}@example.com`,
      emailVerified: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .run()
  await db
    .insert(organization)
    .values({
      id,
      name: "Repository Test Organization",
      slug: id,
      createdAt: timestamp,
    })
    .run()
  await db
    .insert(member)
    .values({
      id: `${id}-member`,
      organizationId: id,
      userId,
      role,
      createdAt: timestamp,
    })
    .run()
}

export function record({
  id,
  slug,
  organizationId,
  createdById = "repo-test-user-1",
  alias = "Example location",
  createdAt = timestamp,
  updatedAt = createdAt,
  deletedAt = null,
  claimable = organizationId === null,
  claimedById = null,
  claimedAt = null,
  target,
  expiresAt = null,
}: Partial<NewQrRecord> & Pick<NewQrRecord, "id" | "slug" | "organizationId">): NewQrRecord {
  return {
    id,
    alias,
    slug,
    organizationId,
    createdById,
    claimedById,
    claimedAt,
    claimable,
    expiresAt,
    createdAt,
    updatedAt,
    deletedAt,
    target,
  }
}
