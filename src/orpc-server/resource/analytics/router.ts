import {
  handleErrors,
  implementer,
  requireAuth,
  requireGlobalAdmin,
} from "@/orpc-server/implementer"
import type { AnalyticsService } from "@/orpc-server/resource/analytics/service"

export function createAnalyticsRouter({ service }: { service: AnalyticsService }) {
  return {
    qr: {
      hourly: implementer.analytics.qr.hourly
        .use(handleErrors)
        .use(requireAuth)
        .handler(({ context, input }) => service.getQrHourly({ actor: context.user, ...input })),
      fill: implementer.analytics.qr.fill
        .use(handleErrors)
        .use(requireAuth)
        .use(requireGlobalAdmin)
        .handler(({ context, input }) => service.fillQrHourly({ actor: context.user, ...input })),
    },
    organization: {
      hourly: implementer.analytics.organization.hourly
        .use(handleErrors)
        .use(requireAuth)
        .handler(({ context, input }) =>
          service.getOrganizationHourly({ actor: context.user, ...input }),
        ),
    },
    cleanup: implementer.analytics.cleanup
      .use(handleErrors)
      .use(requireAuth)
      .use(requireGlobalAdmin)
      .handler(({ context }) => service.deleteExpired({ actor: context.user })),
  }
}
