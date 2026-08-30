# QR

QR is an Astro application running on Cloudflare Workers. It uses Cloudflare
D1 with Drizzle ORM, Better Auth, and oRPC.

Vite+ is the project command surface. Its dependency commands use the pinned
pnpm version and its runtime uses the pinned Node.js version declared in
`package.json`.

## Local Setup

1. Install dependencies with `vp install`.
2. Enable the Vite+ Git hook dispatcher with `vp hooks enable`.
3. Create a local `.dev.vars` file from `.dev.vars.example`.
4. Replace the D1 placeholder in `wrangler.jsonc` with the ID from
   `vp exec wrangler d1 create qr` before using a remote database.
5. Create a KV namespace with `vp exec wrangler kv namespace create PLACES_CACHE`.
6. Create a second KV namespace with `vp exec wrangler kv namespace create QR_PUBLIC_PROJECTION`.
7. Replace both KV placeholders in `wrangler.jsonc` and
   `wrangler.integration.jsonc` with their environment-specific namespace IDs.
8. Generate Worker types with `vp run generate-types`.
9. Generate the Better Auth schema with `vp run auth:generate`.
10. Generate Drizzle migrations with `vp run db:generate`.
11. Apply local migrations with `vp run db:migrate:local`.

Before relying on KV during a production D1 outage, backfill existing records with
`vp run backfill-qr-public-projection -- --remote`. This requires authenticated
Wrangler access and writes active, setup, and archived projections in batches with
a seven-day expiration.
Run this backfill again after applying a public projection schema change so existing records receive
the current projection version and expiry data.

## Commands

| Command                                            | Action                                   |
| -------------------------------------------------- | ---------------------------------------- |
| `vp run dev`                                       | Start the local Astro/Worker dev server  |
| `vp run build`                                     | Build the Astro application              |
| `vp run preview`                                   | Preview the production build             |
| `vp run backfill-qr-public-projection -- --remote` | Backfill public QR projections into KV   |
| `vp check`                                         | Format, lint, and type-check the project |
| `vp test`                                          | Run the Vite+ unit test suite            |
| `vp run test:integration`                          | Run real D1 tests in the Workers runtime |
| `vp run quality`                                   | Run cacheable Vite+ quality checks       |
| `vp run unit`                                      | Run cacheable Vite+ unit tests           |
| `vp run astro-build`                               | Run a cacheable Astro production build   |
| `vp run generate-types`                            | Generate Cloudflare Worker types         |
| `vp run auth:generate`                             | Generate Better Auth's Drizzle schema    |
| `vp run db:generate`                               | Generate Drizzle SQL migrations          |
| `vp run db:migrate:local`                          | Apply migrations to local D1             |
| `vp run db:migrate:remote`                         | Apply migrations to remote D1            |

## Integration Endpoints

- Better Auth: `/api/auth/*`
- oRPC: `/rpc/*`
- Protected app: `/app/*`
