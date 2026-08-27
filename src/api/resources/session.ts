import { implementer, requireAuth } from "@/api/implementer"

export function createSession() {
  return {
    current: implementer.session
      .use(requireAuth)
      .current.handler(({ context }) => ({
        user: {
          id: context.user.id,
          email: context.user.email,
          name: context.user.name,
        },
        expiresAt: context.session.expiresAt.toISOString(),
      })),
  }
}
