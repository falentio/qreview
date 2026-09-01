import { call } from "@orpc/server"
import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { ApiContext } from "@/orpc-server/context"
import type { AuthSession, SessionRepository } from "@/orpc-server/resource/session/repository"
import { SessionService } from "@/orpc-server/resource/session/service"
import {
  createQrRecord,
  globalAdmin,
  googleCanonicalReviewUrl,
  googleMapsUrl,
  googlePlaceId,
  owner,
} from "@/orpc-server/resource/qr/fixtures"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"
import { createQrRouter } from "@/orpc-server/resource/qr/router"
import { QrService } from "@/orpc-server/resource/qr/service"
import { testLogger } from "@/orpc-server/testing/logger"

const targetUrl = googleMapsUrl

function createOrganizationAuth(role: string, error?: unknown): ApiContext["auth"] {
  return {
    api: {
      getActiveMemberRole: async () => {
        if (error) throw error
        return { role }
      },
    },
  } as unknown as ApiContext["auth"]
}

function setup({
  role = "user",
  organizationRole = "owner",
  organizationError,
}: { role?: string; organizationRole?: string; organizationError?: unknown } = {}) {
  const repository = mock<QrRepository>()
  repository.getOrganizationMemberRole.mockResolvedValue("owner")
  const service = new QrService({
    repository,
    ids: {
      generateId: () => "generated-id",
      generateSlug: () => "generated1a",
    },
  })
  const sessionRepository = mock<SessionRepository>()
  sessionRepository.getCurrentSession.mockResolvedValue({
    user: {
      id: role === "admin" ? globalAdmin.id : owner.id,
      email: "owner@example.com",
      name: "Example Owner",
      role,
    },
    session: { expiresAt: new Date("2030-01-01T00:00:00.000Z") },
  } as AuthSession)
  const context = {
    request: new Request("http://localhost/rpc"),
    requestId: "test-request",
    logger: testLogger,
    db: {} as ApiContext["db"],
    auth: createOrganizationAuth(organizationRole, organizationError),
    sessionService: new SessionService({ repository: sessionRepository }),
  } satisfies ApiContext

  return { context, repository, router: createQrRouter({ service }) }
}

describe("QrRouter behavior", () => {
  it("resolves a Google Maps URL through the authenticated route", async () => {
    const { context, router } = setup()

    await expect(
      call(
        router.resolve,
        {
          organizationId: "org-1",
          googleMapsUrl: targetUrl,
        },
        { context },
      ),
    ).resolves.toEqual({
      candidates: [{ placeId: googlePlaceId, name: "Example", address: null }],
    })
  })

  it("resolves a Google Maps URL through the global admin route without an organization", async () => {
    const { context, repository, router } = setup({ role: "admin" })

    await expect(
      call(router.resolvePlace, { googleMapsUrl: targetUrl }, { context }),
    ).resolves.toEqual({
      candidates: [{ placeId: googlePlaceId, name: "Example", address: null }],
    })
    expect(repository.getOrganizationMemberRole.mock.calls).toHaveLength(0)
  })

  it("verifies an active QR code through the global admin route", async () => {
    const { context, repository, router } = setup({ role: "admin" })
    repository.findBySlug.mockResolvedValue(createQrRecord({ slug: "abc123def4" }))

    await expect(call(router.verifyBySlug, { slug: "abc123def4" }, { context })).resolves.toEqual({
      slug: "abc123def4",
      expiresAt: null,
    })
  })

  it("creates a QR code through the authenticated route", async () => {
    const { context, repository, router } = setup()
    repository.create.mockResolvedValue(createQrRecord({ alias: "New QR" }))

    await expect(
      call(
        router.create,
        {
          organizationId: "org-1",
          alias: " New QR ",
          googleMapsUrl: targetUrl,
          googlePlaceId: googlePlaceId,
        },
        { context },
      ),
    ).resolves.toMatchObject({ alias: "New QR", configurationState: "active" })
  })

  it("creates an orphan through the global admin route", async () => {
    const { context, repository, router } = setup({ role: "admin" })
    repository.create.mockResolvedValue(createQrRecord({ organizationId: null, alias: "Orphan" }))

    await expect(
      call(router.createOrphan, { alias: " Orphan " }, { context }),
    ).resolves.toMatchObject({
      alias: "Orphan",
      ownershipState: "orphan",
      claimable: true,
    })
  })

  it("batch creates configured QR codes through the global admin route", async () => {
    const { context, repository, router } = setup({ role: "admin" })
    repository.create.mockResolvedValue(createQrRecord({ alias: "Batch QR" }))

    await expect(
      call(
        router.batchCreate,
        {
          organizationId: "org-1",
          alias: "Batch QR",
          googleMapsUrl: targetUrl,
          googlePlaceId: googlePlaceId,
          count: 2,
        },
        { context },
      ),
    ).resolves.toMatchObject({ items: [{ alias: "Batch QR" }, { alias: "Batch QR" }] })
    expect(repository.create.mock.calls).toHaveLength(2)
  })

  it("batch creates configured orphan QR codes through the global admin route", async () => {
    const { context, repository, router } = setup({ role: "admin" })
    repository.create.mockResolvedValue(createQrRecord({ organizationId: null, alias: "Batch QR" }))

    await expect(
      call(
        router.batchCreateOrphan,
        {
          alias: "Batch QR",
          googleMapsUrl: targetUrl,
          googlePlaceId: googlePlaceId,
          count: 2,
        },
        { context },
      ),
    ).resolves.toMatchObject({ items: [{ alias: "Batch QR" }, { alias: "Batch QR" }] })
    expect(repository.create.mock.calls).toHaveLength(2)
    expect(repository.create.mock.calls.map(([input]) => input.organizationId)).toEqual([
      null,
      null,
    ])
  })

  it("batch creates incomplete orphan QR codes without a target", async () => {
    const { context, repository, router } = setup({ role: "admin" })
    repository.create.mockResolvedValue(
      createQrRecord({
        organizationId: null,
        rawGoogleMapsUrl: null,
        googlePlaceId: null,
        canonicalReviewUrl: null,
      }),
    )

    await expect(
      call(router.batchCreateOrphan, { alias: "Batch QR", count: 2 }, { context }),
    ).resolves.toMatchObject({
      items: [
        { ownershipState: "orphan", configurationState: "incomplete" },
        { ownershipState: "orphan", configurationState: "incomplete" },
      ],
    })
    expect(repository.create.mock.calls.map(([input]) => input.target)).toEqual([
      undefined,
      undefined,
    ])
  })

  it("updates an orphan map link by slug through the global admin route", async () => {
    const { context, repository, router } = setup({ role: "admin" })
    repository.findBySlug.mockResolvedValue(createQrRecord({ organizationId: null }))
    repository.updateMapBySlug.mockResolvedValue(
      createQrRecord({
        organizationId: null,
        rawGoogleMapsUrl: targetUrl,
        googlePlaceId,
        canonicalReviewUrl: googleCanonicalReviewUrl,
      }),
    )

    await expect(
      call(
        router.updateMapBySlug,
        {
          slug: "abc123def4",
          googleMapsUrl: targetUrl,
          googlePlaceId,
        },
        { context },
      ),
    ).resolves.toMatchObject({
      slug: "abc123def4",
      organizationId: null,
      configurationState: "active",
    })
    expect(repository.updateMapBySlug.mock.calls).toHaveLength(1)
  })

  it("updates QR expiry through the global admin route", async () => {
    const { context, repository, router } = setup({ role: "admin" })
    repository.findBySlug.mockResolvedValue(createQrRecord({ organizationId: null }))
    repository.setExpirationBySlug.mockResolvedValue(
      createQrRecord({
        organizationId: null,
        expiresAt: new Date("2030-02-01T00:00:00.000Z"),
      }),
    )

    await expect(
      call(
        router.setExpirationBySlug,
        { slug: "abc123def4", expiresAt: "2030-02-01T00:00:00.000Z" },
        { context },
      ),
    ).resolves.toMatchObject({ expiresAt: "2030-02-01T00:00:00.000Z" })
    expect(repository.setExpirationBySlug.mock.calls).toEqual([
      [
        {
          slug: "abc123def4",
          expiresAt: new Date("2030-02-01T00:00:00.000Z"),
          updatedAt: expect.any(Date),
        },
      ],
    ])
  })

  it("rejects global-admin QR operations for regular users", async () => {
    const { context, repository, router } = setup()

    await expect(
      call(
        router.batchCreate,
        {
          organizationId: "org-1",
          alias: "Batch QR",
          googleMapsUrl: targetUrl,
          googlePlaceId,
          count: 2,
        },
        { context },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(
      call(router.resolvePlace, { googleMapsUrl: targetUrl }, { context }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(
      call(router.verifyBySlug, { slug: "abc123def4" }, { context }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(
      call(
        router.batchCreateOrphan,
        {
          alias: "Batch QR",
          googleMapsUrl: targetUrl,
          googlePlaceId,
          count: 2,
        },
        { context },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(
      call(
        router.updateMapBySlug,
        {
          slug: "abc123def4",
          googleMapsUrl: targetUrl,
          googlePlaceId,
        },
        { context },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(
      call(
        router.setExpirationBySlug,
        { slug: "abc123def4", expiresAt: "2030-02-01T00:00:00.000Z" },
        { context },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(repository.findBySlug.mock.calls).toHaveLength(0)
    expect(repository.create.mock.calls).toHaveLength(0)
  })

  it("rejects organization routes for non-admin members", async () => {
    const { context, repository, router } = setup({ organizationRole: "member" })

    await expect(call(router.list, { organizationId: "org-1" }, { context })).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    )
    expect(repository.getOrganizationMemberRole.mock.calls).toHaveLength(0)
    expect(repository.listForOrganization.mock.calls).toHaveLength(0)
  })

  it("reports organization membership outages as unavailable", async () => {
    const { context, router } = setup({ organizationError: new Error("auth database unavailable") })

    await expect(call(router.list, { organizationId: "org-1" }, { context })).rejects.toMatchObject(
      {
        code: "SERVICE_UNAVAILABLE",
      },
    )
  })

  it("claims an orphan through the conditional claim route", async () => {
    const { context, repository, router } = setup()
    repository.findBySlug.mockResolvedValue(createQrRecord({ organizationId: null }))
    repository.claimBySlug.mockResolvedValue(
      createQrRecord({ organizationId: "org-1", claimedById: owner.id, claimable: false }),
    )

    await expect(
      call(router.claim, { organizationId: "org-1", slug: "abc123def4" }, { context }),
    ).resolves.toMatchObject({ organizationId: "org-1", claimable: false })
  })

  it("rejects QR adoption for non-admin organization members", async () => {
    const { context, router } = setup({ organizationRole: "member" })

    await expect(
      call(router.claim, { organizationId: "org-1", slug: "abc123def4" }, { context }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("lists, gets, updates, archives, and restores organization QR codes", async () => {
    const { context, repository, router } = setup()
    const active = createQrRecord()
    repository.listForOrganization.mockResolvedValue([active])
    repository.findById.mockResolvedValue(active)
    repository.updateById.mockResolvedValue(createQrRecord({ alias: "Updated" }))
    repository.archiveById.mockResolvedValue(
      createQrRecord({ deletedAt: new Date("2030-01-01T00:00:00.000Z") }),
    )
    repository.restoreById.mockResolvedValue(active)

    await expect(
      call(router.list, { organizationId: "org-1" }, { context }),
    ).resolves.toMatchObject({ items: [{ id: "qr-1", alias: "Example location" }] })
    await expect(
      call(router.get, { organizationId: "org-1", id: "qr-1" }, { context }),
    ).resolves.toMatchObject({ id: "qr-1", organizationId: "org-1" })
    await expect(
      call(router.update, { organizationId: "org-1", id: "qr-1", alias: "Updated" }, { context }),
    ).resolves.toMatchObject({ alias: "Updated" })
    await expect(
      call(router.archive, { organizationId: "org-1", id: "qr-1" }, { context }),
    ).resolves.toMatchObject({ deletedAt: "2030-01-01T00:00:00.000Z" })
    await expect(
      call(router.restore, { organizationId: "org-1", id: "qr-1" }, { context }),
    ).resolves.toMatchObject({ deletedAt: null })
  })

  it("requires authentication on every QR route", async () => {
    const { repository, router } = setup()
    const sessionRepository = mock<SessionRepository>()
    sessionRepository.getCurrentSession.mockResolvedValue(null)
    const context = {
      request: new Request("http://localhost/rpc"),
      requestId: "test-request",
      logger: testLogger,
      db: {} as ApiContext["db"],
      auth: createOrganizationAuth("owner"),
      sessionService: new SessionService({ repository: sessionRepository }),
    } satisfies ApiContext

    const attempts = [
      () =>
        call(router.resolve, { organizationId: "org-1", googleMapsUrl: targetUrl }, { context }),
      () =>
        call(
          router.create,
          {
            organizationId: "org-1",
            alias: "QR",
            googleMapsUrl: targetUrl,
            googlePlaceId: googlePlaceId,
          },
          { context },
        ),
      () =>
        call(
          router.batchCreate,
          {
            organizationId: "org-1",
            alias: "QR",
            googleMapsUrl: targetUrl,
            googlePlaceId,
            count: 2,
          },
          { context },
        ),
      () => call(router.resolvePlace, { googleMapsUrl: targetUrl }, { context }),
      () => call(router.verifyBySlug, { slug: "abc123def4" }, { context }),
      () =>
        call(
          router.batchCreateOrphan,
          {
            alias: "QR",
            googleMapsUrl: targetUrl,
            googlePlaceId,
            count: 2,
          },
          { context },
        ),
      () => call(router.createOrphan, { alias: "QR" }, { context }),
      () => call(router.claim, { organizationId: "org-1", slug: "abc123def4" }, { context }),
      () => call(router.list, { organizationId: "org-1" }, { context }),
      () => call(router.get, { organizationId: "org-1", id: "qr-1" }, { context }),
      () => call(router.update, { organizationId: "org-1", id: "qr-1", alias: "QR" }, { context }),
      () =>
        call(
          router.updateMapBySlug,
          {
            slug: "abc123def4",
            googleMapsUrl: targetUrl,
            googlePlaceId,
          },
          { context },
        ),
      () => call(router.setExpirationBySlug, { slug: "abc123def4", expiresAt: null }, { context }),
      () => call(router.archive, { organizationId: "org-1", id: "qr-1" }, { context }),
      () => call(router.restore, { organizationId: "org-1", id: "qr-1" }, { context }),
    ]

    for (const attempt of attempts) {
      await expect(attempt()).rejects.toMatchObject({ code: "UNAUTHORIZED" })
    }
    expect(repository.getOrganizationMemberRole.mock.calls).toHaveLength(0)
  })
})
