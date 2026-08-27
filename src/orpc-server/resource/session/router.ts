import { implementer, requireAuth } from "@/orpc-server/implementer"
import type { SessionService } from "@/orpc-server/resource/session/service"

export function createSessionRouter({
  service,
}: {
  service: SessionService
}) {
  return {
    current: implementer.session.current
      .use(requireAuth)
      .handler(({ context }) =>
        service.toCurrentSessionResponse({
          user: context.user,
          session: context.session,
        }),
      ),
  }
}
