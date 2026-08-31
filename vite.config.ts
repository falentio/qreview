import { fileURLToPath, URL } from "node:url"

import { defineConfig } from "vite-plus"

const ignoredPaths = [
  "dist/**",
  ".astro/**",
  ".alchemy/**",
  ".playwright-mcp/**",
  "drizzle/meta/**",
  "drizzle/**/snapshot.json",
  "src/db/auth-schema.ts",
  "worker-configuration.d.ts",
]

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  fmt: {
    ignorePatterns: ignoredPaths,
    singleQuote: false,
    semi: false,
  },

  lint: {
    ignorePatterns: ignoredPaths,
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },

  test: {
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["src/**/*.integration.test.ts"],
  },

  run: {
    tasks: {
      quality: {
        command: "vp check",
      },
      unit: {
        command: "vp test",
      },
      "alchemy-plan": {
        command: "alchemy plan",
        input: [
          "src/**",
          "public/**",
          "astro.config.mjs",
          "tsconfig.json",
          "alchemy.run.ts",
          "package.json",
          "pnpm-lock.yaml",
        ],
      },
    },
  },

  staged: {
    "*.{js,mjs,cjs,ts,tsx,astro,css,json,jsonc,md,yaml,yml}": "vp check --fix",
  },
})
