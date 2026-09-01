import { readdir } from "node:fs/promises"
import path from "node:path"

import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers"
import { defineConfig } from "vite-plus"

export default defineConfig(async () => {
  const migrationsDirectory = path.join(import.meta.dirname, "drizzle")
  const migrationDirectories = (await readdir(migrationsDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  const migrations = (
    await Promise.all(
      migrationDirectories.map(async (directory) => {
        const [migration] = await readD1Migrations(path.join(migrationsDirectory, directory))
        return migration ? { ...migration, name: `${directory}/migration.sql` } : []
      }),
    )
  ).flat()

  return {
    plugins: [
      cloudflareTest({
        main: "./test/worker/worker.ts",
        miniflare: {
          compatibilityDate: "2026-08-22",
          d1Databases: { DB: "qr-integration-tests" },
          kvNamespaces: ["QR_PUBLIC_PROJECTION"],
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
