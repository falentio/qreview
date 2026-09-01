// @ts-check
import { defineConfig } from "astro/config"

import react from "@astrojs/react"

import tailwindcss from "@tailwindcss/vite"

// https://astro.build/config
export default defineConfig({
  server: {
    host: true,
    allowedHosts: [".falentio"],
  },

  integrations: [react()],

  prefetch: {
    prefetchAll: false,
    defaultStrategy: "viewport",
  },

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ["astro/assets/services/noop", "astro/logger/json"],
      exclude: ["qr-scanner"],
    },
    resolve: {
      dedupe: ["react", "react-dom"],
    },
  },
})
