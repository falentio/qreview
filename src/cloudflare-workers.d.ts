declare module "cloudflare:workers" {
  const env: import("../alchemy.run.ts").WebsiteEnv & {
    TEST_MIGRATIONS: Parameters<typeof import("cloudflare:test").applyD1Migrations>[1]
  }
  function waitUntil(promise: Promise<unknown>): void
  export { env, waitUntil }
}
