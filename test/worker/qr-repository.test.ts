import { beforeEach, describe, expect, it } from "vite-plus/test"

import { member, organization, user } from "@/db/auth-schema"
import { createDb } from "@/db/client"
import { env } from "cloudflare:workers"
import type { NewQrRecord } from "@/orpc-server/resource/qr/repository"
import { QrRepository } from "@/orpc-server/resource/qr/repository"

const db = createDb(env.DB)
const repository = new QrRepository({ db })
const timestamp = new Date("2030-01-01T00:00:00.000Z")

async function clearTestData() {
  await env.DB.prepare("DELETE FROM qr_codes WHERE id LIKE ?").bind("repo-test-%").run()
  await env.DB.prepare("DELETE FROM member WHERE id LIKE ?").bind("repo-test-%").run()
  await env.DB.prepare("DELETE FROM organization WHERE id LIKE ?").bind("repo-test-%").run()
  await env.DB.prepare("DELETE FROM user WHERE id LIKE ?").bind("repo-test-%").run()
}

async function createOrganization({
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

function record({
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
    createdAt,
    updatedAt,
    deletedAt,
    target,
  }
}

beforeEach(async () => {
  await clearTestData()
})

describe("QrRepository against D1", () => {
  it("creates and retrieves a complete QR record", async () => {
    await createOrganization({ id: "repo-test-org-1", userId: "repo-test-user-1" })
    const input = record({
      id: "repo-test-qr-1",
      slug: "repo123456",
      organizationId: "repo-test-org-1",
      target: {
        rawGoogleMapsUrl: "https://www.google.com/maps/search/?query=Example",
        googlePlaceId: "ChIJ123456789",
        canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ123456789",
      },
      claimable: false,
    })

    const created = await repository.create(input)
    const loaded = await repository.findById({ id: input.id })

    expect(created).toMatchObject({
      id: "repo-test-qr-1",
      slug: "repo123456",
      organizationId: "repo-test-org-1",
      rawGoogleMapsUrl: "https://www.google.com/maps/search/?query=Example",
      googlePlaceId: "ChIJ123456789",
      canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ123456789",
      claimable: false,
    })
    expect(loaded).toEqual(created)
    await expect(repository.findBySlug({ slug: "repo123456" })).resolves.toEqual(created)
  })

  it("returns only the requested organization and orders records by creation time", async () => {
    await createOrganization({ id: "repo-test-org-1", userId: "repo-test-user-1" })
    await createOrganization({ id: "repo-test-org-2", userId: "repo-test-user-2" })
    await repository.create(
      record({
        id: "repo-test-qr-early",
        slug: "repoearly1",
        organizationId: "repo-test-org-1",
        createdAt: new Date("2030-01-01T00:00:00.000Z"),
      }),
    )
    await repository.create(
      record({
        id: "repo-test-qr-late",
        slug: "repo-late1",
        organizationId: "repo-test-org-1",
        createdAt: new Date("2030-01-03T00:00:00.000Z"),
      }),
    )
    await repository.create(
      record({
        id: "repo-test-qr-other",
        slug: "repoother1",
        organizationId: "repo-test-org-2",
      }),
    )

    const records = await repository.listForOrganization({
      organizationId: "repo-test-org-1",
      includeArchived: false,
    })

    expect(records.map(({ id }) => id)).toEqual(["repo-test-qr-early", "repo-test-qr-late"])
    expect(
      await repository.getOrganizationMemberRole({
        organizationId: "repo-test-org-1",
        userId: "repo-test-user-1",
      }),
    ).toBe("owner")
    await expect(
      repository.getOrganizationMemberRole({
        organizationId: "repo-test-org-2",
        userId: "repo-test-user-1",
      }),
    ).resolves.toBeNull()
  })

  it("excludes archived records by default and includes them on request", async () => {
    await createOrganization({ id: "repo-test-org-1", userId: "repo-test-user-1" })
    await repository.create(
      record({
        id: "repo-test-qr-archived",
        slug: "repoarchiv",
        organizationId: "repo-test-org-1",
        deletedAt: new Date("2030-01-02T00:00:00.000Z"),
      }),
    )

    await expect(
      repository.listForOrganization({
        organizationId: "repo-test-org-1",
        includeArchived: false,
      }),
    ).resolves.toEqual([])
    await expect(
      repository.listForOrganization({
        organizationId: "repo-test-org-1",
        includeArchived: true,
      }),
    ).resolves.toHaveLength(1)
  })

  it("claims an eligible orphan once and rejects subsequent claims", async () => {
    await createOrganization({ id: "repo-test-org-1", userId: "repo-test-user-1" })
    await createOrganization({ id: "repo-test-org-2", userId: "repo-test-user-2" })
    await repository.create(
      record({
        id: "repo-test-qr-orphan",
        slug: "reporphan1",
        organizationId: null,
        claimable: true,
      }),
    )

    const claimed = await repository.claimBySlug({
      slug: "reporphan1",
      organizationId: "repo-test-org-1",
      claimedById: "repo-test-user-1",
      claimedAt: timestamp,
      updatedAt: timestamp,
    })
    const secondClaim = await repository.claimBySlug({
      slug: "reporphan1",
      organizationId: "repo-test-org-2",
      claimedById: "repo-test-user-2",
      claimedAt: timestamp,
      updatedAt: timestamp,
    })

    expect(claimed).toMatchObject({
      organizationId: "repo-test-org-1",
      claimedById: "repo-test-user-1",
      claimable: false,
    })
    expect(secondClaim).toBeNull()
  })

  it("updates, archives, and restores only the requested organization record", async () => {
    await createOrganization({ id: "repo-test-org-1", userId: "repo-test-user-1" })
    await createOrganization({ id: "repo-test-org-2", userId: "repo-test-user-2" })
    await repository.create(
      record({
        id: "repo-test-qr-update",
        slug: "repoupdate1",
        organizationId: "repo-test-org-1",
      }),
    )

    await expect(
      repository.updateById({
        id: "repo-test-qr-update",
        organizationId: "repo-test-org-2",
        alias: "Wrong organization",
        updatedAt: timestamp,
      }),
    ).resolves.toBeNull()
    const updated = await repository.updateById({
      id: "repo-test-qr-update",
      organizationId: "repo-test-org-1",
      alias: "Updated location",
      target: {
        rawGoogleMapsUrl: "https://www.google.com/maps/search/?query=Updated",
        googlePlaceId: "ChIJ987654321",
        canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ987654321",
      },
      updatedAt: new Date("2030-01-02T00:00:00.000Z"),
    })
    const archived = await repository.archiveById({
      id: "repo-test-qr-update",
      organizationId: "repo-test-org-1",
      deletedAt: new Date("2030-01-03T00:00:00.000Z"),
      updatedAt: new Date("2030-01-03T00:00:00.000Z"),
    })
    const restored = await repository.restoreById({
      id: "repo-test-qr-update",
      organizationId: "repo-test-org-1",
      updatedAt: new Date("2030-01-04T00:00:00.000Z"),
    })

    expect(updated).toMatchObject({ alias: "Updated location", googlePlaceId: "ChIJ987654321" })
    expect(archived?.deletedAt).toEqual(new Date("2030-01-03T00:00:00.000Z"))
    expect(restored?.deletedAt).toBeNull()
  })

  it("translates duplicate slugs into a domain conflict", async () => {
    await createOrganization({ id: "repo-test-org-1", userId: "repo-test-user-1" })
    await repository.create(
      record({
        id: "repo-test-qr-first",
        slug: "repodupes1",
        organizationId: "repo-test-org-1",
        claimable: false,
      }),
    )

    await expect(
      repository.create(
        record({
          id: "repo-test-qr-second",
          slug: "repodupes1",
          organizationId: "repo-test-org-1",
          claimable: false,
        }),
      ),
    ).rejects.toMatchObject({
      code: "SLUG_CONFLICT",
      httpCode: "CONFLICT",
    })
  })
})
