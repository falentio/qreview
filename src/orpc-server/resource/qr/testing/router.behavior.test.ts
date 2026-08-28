import { call } from "@orpc/server"
import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import type { ApiContext } from "@/orpc-server/context"
import type { AuthSession, SessionRepository } from "@/orpc-server/resource/session/repository"
import { SessionService } from "@/orpc-server/resource/session/service"
import { createQrRecord, globalAdmin, owner } from "@/orpc-server/resource/qr/fixtures"
import type { PlacesAdapter } from "@/orpc-server/resource/qr/places"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"
import { createQrRouter } from "@/orpc-server/resource/qr/router"
import { QrService } from "@/orpc-server/resource/qr/service"

const targetUrl =
  "https://www.google.com/maps/search/?api=1&query=Example&query_place_id=ChIJ123456789"
const placeDetails = {
  placeId: "ChIJ123456789",
  name: "Example location",
  address: "1 Example Street",
  canonicalReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ123456789",
}

function createOrganizationAuth(role: string): ApiContext["auth"] {
  return {
    api: {
      getActiveMemberRole: async () => ({ role }),
    },
  } as unknown as ApiContext["auth"]
}

function setup({
  role = "user",
  organizationRole = "owner",
}: { role?: string; organizationRole?: string } = {}) {
  const repository = mock<QrRepository>()
  const places = mock<PlacesAdapter>()
  repository.getOrganizationMemberRole.mockResolvedValue("owner")
  const service = new QrService({
    repository,
    places,
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
    db: {} as ApiContext["db"],
    auth: createOrganizationAuth(organizationRole),
    sessionService: new SessionService({ repository: sessionRepository }),
  } satisfies ApiContext

  return { context, places, repository, router: createQrRouter({ service }) }
}

describe("QrRouter behavior", () => {
  it("resolves a Google Maps URL through the authenticated route", async () => {
    const { context, places, router } = setup()
    places.search.mockResolvedValue([
      { placeId: "ChIJ123456789", name: "Example location", address: "1 Example Street" },
    ])

    await expect(
      call(
        router.resolve,
        {
          organizationId: "org-1",
          googleMapsUrl: "https://www.google.com/maps/search/?query=Example",
        },
        { context },
      ),
    ).resolves.toEqual({
      candidates: [
        { placeId: "ChIJ123456789", name: "Example location", address: "1 Example Street" },
      ],
    })
  })

  it("creates a QR code through the authenticated route", async () => {
    const { context, places, repository, router } = setup()
    places.getPlaceDetails.mockResolvedValue(placeDetails)
    repository.create.mockResolvedValue(createQrRecord({ alias: "New QR" }))

    await expect(
      call(
        router.create,
        {
          organizationId: "org-1",
          alias: " New QR ",
          googleMapsUrl: targetUrl,
          googlePlaceId: placeDetails.placeId,
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

  it("rejects organization routes for non-admin members", async () => {
    const { context, repository, router } = setup({ organizationRole: "member" })

    await expect(call(router.list, { organizationId: "org-1" }, { context })).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    )
    expect(repository.getOrganizationMemberRole.mock.calls).toHaveLength(0)
    expect(repository.listForOrganization.mock.calls).toHaveLength(0)
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
    const { places, repository, router } = setup()
    const sessionRepository = mock<SessionRepository>()
    sessionRepository.getCurrentSession.mockResolvedValue(null)
    const context = {
      request: new Request("http://localhost/rpc"),
      db: {} as ApiContext["db"],
      auth: createOrganizationAuth("owner"),
      sessionService: new SessionService({ repository: sessionRepository }),
    } satisfies ApiContext
    places.getPlaceDetails.mockResolvedValue(placeDetails)

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
            googlePlaceId: placeDetails.placeId,
          },
          { context },
        ),
      () => call(router.createOrphan, { alias: "QR" }, { context }),
      () => call(router.claim, { organizationId: "org-1", slug: "abc123def4" }, { context }),
      () => call(router.list, { organizationId: "org-1" }, { context }),
      () => call(router.get, { organizationId: "org-1", id: "qr-1" }, { context }),
      () => call(router.update, { organizationId: "org-1", id: "qr-1", alias: "QR" }, { context }),
      () => call(router.archive, { organizationId: "org-1", id: "qr-1" }, { context }),
      () => call(router.restore, { organizationId: "org-1", id: "qr-1" }, { context }),
    ]

    for (const attempt of attempts) {
      await expect(attempt()).rejects.toMatchObject({ code: "UNAUTHORIZED" })
    }
    expect(repository.getOrganizationMemberRole.mock.calls).toHaveLength(0)
  })
})
