import { auth, db } from "@/lib/auth"

type AuthSession = typeof auth.$Infer.Session

export interface ApiContext {
  request: Request
  db: typeof db
  user: AuthSession["user"] | null
  session: AuthSession["session"] | null
}

export async function createApiContext({
  request,
}: {
  request: Request
}): Promise<ApiContext> {
  const currentSession = await auth.api.getSession({
    headers: request.headers,
  })

  return {
    request,
    db,
    user: currentSession?.user ?? null,
    session: currentSession?.session ?? null,
  }
}
