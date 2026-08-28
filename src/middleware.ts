import { defineMiddleware } from "astro:middleware"

import { auth } from "@/lib/auth"

export const onRequest = defineMiddleware(async (context, next) => {
  const currentSession = await auth.api.getSession({
    headers: context.request.headers,
  })

  context.locals.user = currentSession?.user ?? null
  context.locals.session = currentSession?.session ?? null

  const isAppRoute = context.url.pathname === "/app" || context.url.pathname.startsWith("/app/")
  if (isAppRoute) {
    if (!currentSession) {
      return Response.redirect(new URL("/login", context.url), 302)
    }

    const organizations = await auth.api.listOrganizations({
      headers: context.request.headers,
    })
    if (!organizations?.length) {
      return Response.redirect(new URL("/onboarding/organization", context.url), 302)
    }
  }

  return next()
})
