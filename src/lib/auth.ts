import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import type { BetterAuthOptions } from "better-auth"
import { createAuthMiddleware } from "better-auth/api"
import { betterAuth } from "better-auth/minimal"
import { admin, customSession, organization } from "better-auth/plugins"
import { env } from "cloudflare:workers"
import { eq } from "drizzle-orm"

import { createDb } from "@/db/client"
import { schema } from "@/db/schema"

export const db = createDb(env.DB)

const GLOBAL_ADMIN_EMAIL = "kfalentio@proton.me"

async function promoteConfiguredAdmin(userId: string) {
  await db.update(schema.user).set({ role: "admin" }).where(eq(schema.user.id, userId))
}

const authOptions = {
  basePath: "/api/auth",
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return

      const user = ctx.context.newSession?.user
      if (user?.email !== GLOBAL_ADMIN_EMAIL || user.role === "admin") return

      await promoteConfiguredAdmin(user.id)
    }),
  },
  plugins: [organization(), admin()],
} satisfies BetterAuthOptions

export const auth = betterAuth({
  ...authOptions,
  plugins: [
    ...(authOptions.plugins ?? []),
    customSession(async ({ session, user }) => {
      if (user.email !== GLOBAL_ADMIN_EMAIL || user.role === "admin") return { session, user }

      await promoteConfiguredAdmin(user.id)
      return { session, user: { ...user, role: "admin" } }
    }, authOptions),
  ],
})
