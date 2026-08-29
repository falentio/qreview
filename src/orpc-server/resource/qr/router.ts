import { ORPCError } from "@orpc/server"

import {
  implementer,
  requireAuth,
  requireGlobalAdmin,
  requireOrgsAdmin,
} from "@/orpc-server/implementer"
import { QrDomainError } from "@/orpc-server/resource/qr/errors"
import type { QrService } from "@/orpc-server/resource/qr/service"

export function createQrRouter({ service }: { service: QrService }) {
  return {
    resolve: implementer.qr.resolve.use(requireAuth).handler(({ context, input }) =>
      execute(() =>
        service.resolve({
          actor: context.user,
          organizationId: input.organizationId,
          googleMapsUrl: input.googleMapsUrl,
        }),
      ),
    ),
    resolvePlace: implementer.qr.resolvePlace
      .use(requireAuth)
      .use(requireGlobalAdmin)
      .handler(({ context, input }) =>
        execute(() => service.resolvePlace({ actor: context.user, ...input })),
      ),
    create: implementer.qr.create.use(requireAuth).handler(({ context, input }) =>
      execute(() =>
        service.create({
          actor: context.user,
          organizationId: input.organizationId,
          alias: input.alias,
          googleMapsUrl: input.googleMapsUrl,
          googlePlaceId: input.googlePlaceId,
        }),
      ),
    ),
    batchCreate: implementer.qr.batchCreate
      .use(requireAuth)
      .use(requireGlobalAdmin)
      .handler(({ context, input }) =>
        execute(() => service.batchCreate({ actor: context.user, ...input })),
      ),
    batchCreateOrphan: implementer.qr.batchCreateOrphan
      .use(requireAuth)
      .use(requireGlobalAdmin)
      .handler(({ context, input }) =>
        execute(() => service.batchCreateOrphan({ actor: context.user, ...input })),
      ),
    createOrphan: implementer.qr.createOrphan
      .use(requireAuth)
      .use(requireGlobalAdmin)
      .handler(({ context, input }) =>
        execute(() => service.createOrphan({ actor: context.user, ...input })),
      ),
    claim: implementer.qr.claim
      .use(requireAuth)
      .use(requireOrgsAdmin)
      .handler(({ context, input }) =>
        execute(() => service.claim({ actor: context.user, ...input })),
      ),
    list: implementer.qr.list
      .use(requireAuth)
      .use(requireOrgsAdmin)
      .handler(({ context, input }) =>
        execute(() => service.list({ actor: context.user, ...input })),
      ),
    get: implementer.qr.get
      .use(requireAuth)
      .use(requireOrgsAdmin)
      .handler(({ context, input }) =>
        execute(() => service.get({ actor: context.user, ...input })),
      ),
    verifyBySlug: implementer.qr.verifyBySlug
      .use(requireAuth)
      .use(requireGlobalAdmin)
      .handler(({ context, input }) =>
        execute(() => service.verifyBySlug({ actor: context.user, ...input })),
      ),
    update: implementer.qr.update
      .use(requireAuth)
      .use(requireOrgsAdmin)
      .handler(({ context, input }) =>
        execute(() => service.update({ actor: context.user, ...input })),
      ),
    updateMapBySlug: implementer.qr.updateMapBySlug
      .use(requireAuth)
      .use(requireGlobalAdmin)
      .handler(({ context, input }) =>
        execute(() => service.updateMapBySlug({ actor: context.user, ...input })),
      ),
    archive: implementer.qr.archive
      .use(requireAuth)
      .use(requireOrgsAdmin)
      .handler(({ context, input }) =>
        execute(() => service.archive({ actor: context.user, ...input })),
      ),
    restore: implementer.qr.restore
      .use(requireAuth)
      .use(requireOrgsAdmin)
      .handler(({ context, input }) =>
        execute(() => service.restore({ actor: context.user, ...input })),
      ),
  }
}

async function execute<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action()
  } catch (error) {
    if (error instanceof QrDomainError) {
      throw new ORPCError(error.httpCode, {
        message: error.message,
        data: { code: error.code },
      })
    }
    throw error
  }
}
