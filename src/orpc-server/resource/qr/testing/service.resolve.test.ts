import { describe, expect, it } from "vite-plus/test"
import { mock } from "vitest-mock-extended"

import { googleMapsUrl, googlePlaceId, owner } from "@/orpc-server/resource/qr/fixtures"
import type { GoogleMapsRedirectResolver } from "@/orpc-server/resource/qr/redirect-resolver"
import type { QrRepository } from "@/orpc-server/resource/qr/repository"
import { QrService } from "@/orpc-server/resource/qr/service"

function setup({
  googleMapsRedirectResolver,
}: { googleMapsRedirectResolver?: GoogleMapsRedirectResolver } = {}) {
  const repository = mock<QrRepository>()
  const service = new QrService({
    repository,
    googleMapsRedirectResolver,
    ids: {
      generateId: () => "generated-id",
      generateSlug: () => "generated1a",
    },
  })
  repository.getOrganizationMemberRole.mockResolvedValue("owner")
  return { repository, service }
}

describe("QrService.resolve", () => {
  it("resolves a specific Google Maps URL locally without a provider", async () => {
    const { repository, service } = setup()

    await expect(
      service.resolve({
        actor: owner,
        organizationId: "org-1",
        googleMapsUrl,
      }),
    ).resolves.toEqual({
      candidates: [{ placeId: googlePlaceId, name: "Example", address: null }],
    })
    expect(repository.getOrganizationMemberRole.mock.calls).toEqual([
      [{ organizationId: "org-1", userId: owner.id }],
    ])
  })

  it("classifies organization membership lookup failures as unavailable", async () => {
    const { repository, service } = setup()
    repository.getOrganizationMemberRole.mockRejectedValue(new Error("database unavailable"))

    await expect(
      service.resolve({
        actor: owner,
        organizationId: "org-1",
        googleMapsUrl,
      }),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_UNAVAILABLE",
      message: "Layanan organisasi tidak tersedia untuk sementara.",
    })
  })

  it("rejects a query URL that does not identify a specific place", async () => {
    const { service } = setup()

    await expect(
      service.resolve({
        actor: owner,
        organizationId: "org-1",
        googleMapsUrl: "https://www.google.com/maps/search/?query=Unknown",
      }),
    ).rejects.toMatchObject({
      code: "PLACE_RESOLUTION_FAILED",
      httpCode: "BAD_REQUEST",
    })
  })

  it("resolves a global-admin URL without an organization", async () => {
    const { repository, service } = setup()

    await expect(
      service.resolvePlace({
        actor: { id: "admin-1", role: "admin" },
        googleMapsUrl,
      }),
    ).resolves.toEqual({
      candidates: [{ placeId: googlePlaceId, name: "Example", address: null }],
    })
    expect(repository.getOrganizationMemberRole.mock.calls).toHaveLength(0)
  })

  it("resolves a Google Maps short URL through the injected resolver", async () => {
    const shortUrl = "https://maps.app.goo.gl/uKP1FgLVcksve8vB8"
    const redirectedUrl =
      "https://www.google.com/maps/place/Hadar+Kopi+%26+Jamu/@-7.8840559,112.5184512,17z/data=!3m1!4b1!4m6!3m5!1s0x2e78872eb95f61c3:0x524dc00ed3a1a6ec!8m2!3d-7.8840559!4d112.5184512!16s%2Fg%2F11stf9xb64"
    const googleMapsRedirectResolver = {
      resolve: async (value: string) => {
        expect(value).toBe(shortUrl)
        return redirectedUrl
      },
    }
    const { service } = setup({ googleMapsRedirectResolver })

    await expect(
      service.resolvePlace({
        actor: { id: "admin-1", role: "admin" },
        googleMapsUrl: shortUrl,
      }),
    ).resolves.toEqual({
      candidates: [
        {
          placeId: "ChIJw2FfuS6HeC4R7Kah0w7ATVI",
          name: "Hadar Kopi & Jamu",
          address: null,
        },
      ],
    })
  })
})
