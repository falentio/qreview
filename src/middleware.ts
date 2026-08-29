import { defineMiddleware } from "astro:middleware"

import { auth } from "@/lib/auth"

export const onRequest = defineMiddleware(async (context, next) => {
  const isQrRoute = context.url.pathname === "/r" || context.url.pathname.startsWith("/r/")
  if (isQrRoute) return next()

  const currentSession = await auth.api.getSession({
    headers: context.request.headers,
  })

  context.locals.user = currentSession?.user ?? null
  context.locals.session = currentSession?.session ?? null

  const isAppRoute = context.url.pathname === "/app" || context.url.pathname.startsWith("/app/")
  const isAdminRoute =
    context.url.pathname === "/admin" || context.url.pathname.startsWith("/admin/")

  if (isAdminRoute) {
    if (!currentSession) {
      return Response.redirect(new URL("/login", context.url), 302)
    }

    if (currentSession.user.role !== "admin") {
      return Response.redirect(new URL("/app", context.url), 302)
    }
  }

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
