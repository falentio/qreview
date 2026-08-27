import { fileURLToPath, URL } from "node:url"

import { defineConfig } from "vite-plus"

const ignoredPaths = [
  "dist/**",
  ".astro/**",
  ".wrangler/**",
  ".playwright-mcp/**",
  "drizzle/meta/**",
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
    include: ["src/**/testing/**/*.ts"],
  },

  run: {
    tasks: {
      quality: {
        command: "vp check",
      },
      unit: {
        command: "vp test",
      },
      "astro-build": {
        command: "astro build",
        input: [
          "src/**",
          "public/**",
          "astro.config.mjs",
          "tsconfig.json",
          "wrangler.jsonc",
          "package.json",
          "pnpm-lock.yaml",
        ],
        output: ["dist/**"],
      },
    },
  },

  staged: {
    "*.{js,mjs,cjs,ts,tsx,astro,css,json,jsonc,md,yaml,yml}": "vp check --fix",
  },
})
