import { describe, expect, it, vi } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import { createQrRecord, globalAdmin, owner } from "@/orpc-server/resource/qr/fixtures"
import type { QrPublicProjectionStore } from "@/orpc-server/resource/qr/public-cache"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"
import { QrService } from "@/orpc-server/resource/qr/service"

function setup() {
  const repository = mock<QrRepository>()
  const publicProjection = mock<QrPublicProjectionStore>()
  const service = new QrService({
    repository,
    publicProjection,
    clock: { now: () => new Date("2030-01-01T00:00:00.000Z") },
    ids: {
      generateId: () => "generated-id",
      generateSlug: () => "generated1a",
    },
  })
  return { publicProjection, repository, service }
}

describe("QrService.setExpirationBySlug", () => {
  it("sets a future expiry for a global admin", async () => {
    const { repository, service } = setup()
    repository.findBySlug.mockResolvedValue(createQrRecord())
    repository.setExpirationBySlug.mockResolvedValue(
      createQrRecord({ expiresAt: new Date("2030-02-01T00:00:00.000Z") }),
    )

    await expect(
      service.setExpirationBySlug({
        actor: globalAdmin,
        slug: "abc123def4",
        expiresAt: "2030-02-01T00:00:00.000Z",
      }),
    ).resolves.toMatchObject({ expiresAt: "2030-02-01T00:00:00.000Z" })
    expect(repository.setExpirationBySlug.mock.calls).toEqual([
      [
        {
          slug: "abc123def4",
          expiresAt: new Date("2030-02-01T00:00:00.000Z"),
          updatedAt: new Date("2030-01-01T00:00:00.000Z"),
        },
      ],
    ])
  })

  it("interprets a date-only expiry through the selected UTC day", async () => {
    const { repository, service } = setup()
    repository.findBySlug.mockResolvedValue(createQrRecord())
    repository.setExpirationBySlug.mockResolvedValue(createQrRecord())

    await service.setExpirationBySlug({
      actor: globalAdmin,
      slug: "abc123def4",
      expiresAt: "2030-02-01",
    })

    expect(repository.setExpirationBySlug.mock.calls[0]?.[0].expiresAt).toEqual(
      new Date("2030-02-02T00:00:00.000Z"),
    )
  })

  it("clears an existing expiry", async () => {
    const { repository, service } = setup()
    repository.findBySlug.mockResolvedValue(
      createQrRecord({ expiresAt: new Date("2030-02-01T00:00:00.000Z") }),
    )
    repository.setExpirationBySlug.mockResolvedValue(createQrRecord({ expiresAt: null }))

    await expect(
      service.setExpirationBySlug({ actor: globalAdmin, slug: "abc123def4", expiresAt: null }),
    ).resolves.toMatchObject({ expiresAt: null })
    expect(repository.setExpirationBySlug.mock.calls[0]?.[0].expiresAt).toBeNull()
  })

  it("rejects non-global-admins before reading or changing the QR code", async () => {
    const { repository, service } = setup()

    await expect(
      service.setExpirationBySlug({
        actor: owner,
        slug: "abc123def4",
        expiresAt: "2030-02-01T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(repository.findBySlug.mock.calls).toHaveLength(0)
    expect(repository.setExpirationBySlug.mock.calls).toHaveLength(0)
  })

  it("rejects invalid dates before reading or changing the QR code", async () => {
    const { repository, service } = setup()

    await expect(
      service.setExpirationBySlug({ actor: globalAdmin, slug: "abc123def4", expiresAt: "invalid" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" } satisfies Partial<QrDomainError>)
    expect(repository.findBySlug.mock.calls).toHaveLength(0)
    expect(repository.setExpirationBySlug.mock.calls).toHaveLength(0)
  })

  it("rejects timestamps that are not at the UTC day boundary", async () => {
    const { repository, service } = setup()

    await expect(
      service.setExpirationBySlug({
        actor: globalAdmin,
        slug: "abc123def4",
        expiresAt: "2030-02-01T12:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" })
    expect(repository.findBySlug.mock.calls).toHaveLength(0)
  })

  it("rejects timestamps with invalid calendar dates", async () => {
    const { repository, service } = setup()

    await expect(
      service.setExpirationBySlug({
        actor: globalAdmin,
        slug: "abc123def4",
        expiresAt: "2030-02-31T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" })
    expect(repository.findBySlug.mock.calls).toHaveLength(0)
  })

  it("does not update D1 when an awaited projection write fails", async () => {
    const { publicProjection, repository, service } = setup()
    const failure = new Error("KV unavailable")
    publicProjection.setAndWait = vi.fn(async () => {
      throw failure
    })
    repository.findBySlug.mockResolvedValue(createQrRecord())

    await expect(
      service.setExpirationBySlug({
        actor: globalAdmin,
        slug: "abc123def4",
        expiresAt: "2030-02-01T00:00:00.000Z",
      }),
    ).rejects.toBe(failure)
    expect(repository.setExpirationBySlug.mock.calls).toHaveLength(0)
  })

  it("restores the prior projection when D1 reports no updated row", async () => {
    const { publicProjection, repository, service } = setup()
    const setAndWait = vi.fn(async () => undefined)
    publicProjection.setAndWait = setAndWait
    repository.findBySlug.mockResolvedValue(createQrRecord())
    repository.setExpirationBySlug.mockResolvedValue(null)

    await expect(
      service.setExpirationBySlug({
        actor: globalAdmin,
        slug: "abc123def4",
        expiresAt: "2030-02-01T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect(setAndWait.mock.calls).toHaveLength(2)
    expect(setAndWait.mock.calls[1]).toEqual([expect.objectContaining({ expiresAt: null })])
  })

  it("does not update archived QR codes", async () => {
    const { repository, service } = setup()
    repository.findBySlug.mockResolvedValue(createQrRecord({ deletedAt: new Date() }))

    await expect(
      service.setExpirationBySlug({
        actor: globalAdmin,
        slug: "abc123def4",
        expiresAt: "2030-02-01T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "ARCHIVED" })
    expect(repository.setExpirationBySlug.mock.calls).toHaveLength(0)
  })
})
