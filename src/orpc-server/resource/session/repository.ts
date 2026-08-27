import type { auth } from "@/lib/auth"

export type AuthSession = typeof auth.$Infer.Session

export interface SessionAuth {
  api: typeof auth.api
}

export class SessionRepository {
  constructor(private readonly dependencies: { auth: SessionAuth }) {}

  getCurrentSession({
    headers,
  }: {
    headers: Headers
  }): Promise<AuthSession | null> {
    return this.dependencies.auth.api.getSession({ headers })
  }
}
