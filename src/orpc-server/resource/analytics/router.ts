import { ORPCError } from "@orpc/server"

import { implementer, requireAuth, requireGlobalAdmin } from "@/orpc-server/implementer"
import { AnalyticsDomainError } from "@/orpc-server/resource/analytics/errors"
import type { AnalyticsService } from "@/orpc-server/resource/analytics/service"

export function createAnalyticsRouter({ service }: { service: AnalyticsService }) {
  return {
    qr: {
      hourly: implementer.analytics.qr.hourly
        .use(requireAuth)
        .handler(({ context, input }) =>
          execute(() => service.getQrHourly({ actor: context.user, ...input })),
        ),
    },
    cleanup: implementer.analytics.cleanup
      .use(requireAuth)
      .use(requireGlobalAdmin)
      .handler(({ context }) => execute(() => service.deleteExpired({ actor: context.user }))),
  }
}

async function execute<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action()
  } catch (error) {
    if (error instanceof AnalyticsDomainError) {
      throw new ORPCError(error.httpCode, {
        message: error.message,
        data: { code: error.code },
      })
    }
    throw error
  }
}
