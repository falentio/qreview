import path from "node:path"

import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers"
import { defineConfig } from "vite-plus"

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "drizzle"))

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.integration.jsonc" },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.join(import.meta.dirname, "src"),
      },
    },
    test: {
      include: ["src/orpc-server/resource/**/testing/**/*.integration.test.ts"],
      setupFiles: ["./test/worker/apply-migrations.ts"],
      passWithNoTests: false,
    },
  }
})
