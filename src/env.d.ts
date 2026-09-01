/// <reference path="../.astro/types.d.ts" />

import type { WebsiteEnv } from "../alchemy.run.ts"

declare global {
  interface Env {
    BETTER_AUTH_SECRET: string
    BETTER_AUTH_URL: string
    RAPIDAPI_KEY: string
  }

  namespace Cloudflare {
    interface Env {
      BETTER_AUTH_SECRET: string
      BETTER_AUTH_URL: string
    }
  }

  namespace App {
    interface Locals {
      runtime: { env: WebsiteEnv }
      requestId: string
      logger: import("./lib/logging").AppLogger
      user: import("better-auth").User | null
      session: import("better-auth").Session | null
    }
  }
}
