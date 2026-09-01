import {
  handleErrors,
  implementer,
  requireAuth,
  requireGlobalAdmin,
  requireOrgsAdmin,
} from "@/orpc-server/implementer"
import type { QrService } from "@/orpc-server/resource/qr/service"

export function createQrRouter({ service }: { service: QrService }) {
  return {
    resolve: implementer.qr.resolve
      .use(handleErrors)
      .use(requireAuth)
      .handler(({ context, input }) =>
        service.resolve({
          actor: context.user,
          organizationId: input.organizationId,
          googleMapsUrl: input.googleMapsUrl,
        }),
      ),
    resolvePlace: implementer.qr.resolvePlace
      .use(handleErrors)
      .use(requireAuth)
      .use(requireGlobalAdmin)
      .handler(({ context, input }) => service.resolvePlace({ actor: context.user, ...input })),
    create: implementer.qr.create
      .use(handleErrors)
      .use(requireAuth)
      .handler(({ context, input }) =>
        service.create({
          actor: context.user,
          organizationId: input.organizationId,
          alias: input.alias,
          googleMapsUrl: input.googleMapsUrl,
          googlePlaceId: input.googlePlaceId,
        }),
      ),
    batchCreate: implementer.qr.batchCreate
      .use(handleErrors)
      .use(requireAuth)
      .use(requireGlobalAdmin)
      .handler(({ context, input }) => service.batchCreate({ actor: context.user, ...input })),
    batchCreateOrphan: implementer.qr.batchCreateOrphan
      .use(handleErrors)
      .use(requireAuth)
      .use(requireGlobalAdmin)
      .handler(({ context, input }) =>
        service.batchCreateOrphan({ actor: context.user, ...input }),
      ),
    createOrphan: implementer.qr.createOrphan
      .use(handleErrors)
      .use(requireAuth)
      .use(requireGlobalAdmin)
      .handler(({ context, input }) => service.createOrphan({ actor: context.user, ...input })),
    claim: implementer.qr.claim
      .use(handleErrors)
      .use(requireAuth)
      .use(requireOrgsAdmin)
      .handler(({ context, input }) => service.claim({ actor: context.user, ...input })),
    list: implementer.qr.list
      .use(handleErrors)
      .use(requireAuth)
      .use(requireOrgsAdmin)
      .handler(({ context, input }) => service.list({ actor: context.user, ...input })),
    get: implementer.qr.get
      .use(handleErrors)
      .use(requireAuth)
      .use(requireOrgsAdmin)
      .handler(({ context, input }) => service.get({ actor: context.user, ...input })),
    verifyBySlug: implementer.qr.verifyBySlug
      .use(handleErrors)
      .use(requireAuth)
      .use(requireGlobalAdmin)
      .handler(({ context, input }) => service.verifyBySlug({ actor: context.user, ...input })),
    update: implementer.qr.update
      .use(handleErrors)
      .use(requireAuth)
      .use(requireOrgsAdmin)
      .handler(({ context, input }) => service.update({ actor: context.user, ...input })),
    updateMapBySlug: implementer.qr.updateMapBySlug
      .use(handleErrors)
      .use(requireAuth)
      .use(requireGlobalAdmin)
      .handler(({ context, input }) => service.updateMapBySlug({ actor: context.user, ...input })),
    setExpirationBySlug: implementer.qr.setExpirationBySlug
      .use(handleErrors)
      .use(requireAuth)
      .use(requireGlobalAdmin)
      .handler(({ context, input }) =>
        service.setExpirationBySlug({ actor: context.user, ...input }),
      ),
    archive: implementer.qr.archive
      .use(handleErrors)
      .use(requireAuth)
      .use(requireOrgsAdmin)
      .handler(({ context, input }) => service.archive({ actor: context.user, ...input })),
    restore: implementer.qr.restore
      .use(handleErrors)
      .use(requireAuth)
      .use(requireOrgsAdmin)
      .handler(({ context, input }) => service.restore({ actor: context.user, ...input })),
  }
}
