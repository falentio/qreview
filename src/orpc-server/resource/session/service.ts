import type {
  AuthSession,
  SessionRepository,
} from "@/orpc-server/resource/session/repository"

export type CurrentSessionResponse = {
  user: {
    id: string
    email: string
    name: string
  }
  expiresAt: string
}

export class SessionService {
  constructor(
    private readonly dependencies: {
      repository: Pick<SessionRepository, "getCurrentSession">
    },
  ) {}

  getCurrentSession({
    headers,
  }: {
    headers: Headers
  }): Promise<AuthSession | null> {
    return this.dependencies.repository.getCurrentSession({ headers })
  }

  toCurrentSessionResponse(
    session: AuthSession,
  ): CurrentSessionResponse {
    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
      expiresAt: session.session.expiresAt.toISOString(),
    }
  }
}
