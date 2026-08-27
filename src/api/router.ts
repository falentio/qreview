import { createHealth } from "@/api/resources/health"
import { createSession } from "@/api/resources/session"
import { implementer } from "@/api/implementer"

export const router = implementer.router({
  health: createHealth(),
  session: createSession(),
})

export type AppRouter = typeof router
