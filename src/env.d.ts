/// <reference path="../.astro/types.d.ts" />

interface Env {
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  GOOGLE_MAPS_API_KEY: string
}

declare namespace Cloudflare {
  interface Env {
    BETTER_AUTH_SECRET: string
    BETTER_AUTH_URL: string
    GOOGLE_MAPS_API_KEY: string
  }
}

declare namespace App {
  interface Locals {
    user: import("better-auth").User | null
    session: import("better-auth").Session | null
  }
}
