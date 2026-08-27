import { defineMiddleware } from "astro:middleware"

import { auth } from "@/lib/auth"

export const onRequest = defineMiddleware(async (context, next) => {
  const currentSession = await auth.api.getSession({
    headers: context.request.headers,
  })

  context.locals.user = currentSession?.user ?? null
  context.locals.session = currentSession?.session ?? null

  return next()
})
