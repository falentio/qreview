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
4. Run `vp run dev` to start Alchemy's local Astro/Workers development server.
5. Generate the Better Auth schema with `vp run auth:generate`.
6. Generate Drizzle migrations with `vp run db:generate`.

The checked-in migrations use Drizzle v1's directory layout. For an older checkout
that still has flat SQL files and `drizzle/meta/_journal.json`, run `vp run db:up`
once before generating or deploying migrations.

Alchemy provisions the D1 database and KV namespaces declared in `alchemy.run.ts`.
Migrations in `drizzle/` are applied automatically during deployment. Existing D1
migration history from Wrangler or Drizzle is adopted automatically by Alchemy.

Preview a stage with `vp run plan`. Deploy after reviewing the plan with
`vp exec alchemy deploy --stage prod --env-file .env`. If Alchemy reports an
unowned existing resource, verify its physical name and use `--adopt` explicitly.

Before relying on KV during a production D1 outage, backfill existing records with
`vp run backfill-qr-public-projection -- --remote --stage prod`. This invokes an
Alchemy deploy-time action using the authenticated Cloudflare profile and writes
active, setup, and archived projections with a seven-day expiration.
Run this backfill again after applying a public projection schema change so existing records receive
the current projection version and expiry data.

## Commands

| Command                                            | Action                                   |
| -------------------------------------------------- | ---------------------------------------- |
| `vp run dev`                                       | Start the local Alchemy/Astro dev server |
| `vp run build`                                     | Preview the Alchemy deployment plan      |
| `vp run preview`                                   | Start the local Alchemy/Astro dev server |
| `vp run plan`                                      | Preview infrastructure changes           |
| `vp run deploy`                                    | Deploy the Alchemy stack                 |
| `vp run destroy`                                   | Destroy the selected Alchemy stage       |
| `vp run backfill-qr-public-projection -- --remote` | Backfill public QR projections into KV   |
| `vp check`                                         | Format, lint, and type-check the project |
| `vp test`                                          | Run the Vite+ unit test suite            |
| `vp run test:integration`                          | Run real D1 tests in the Workers runtime |
| `vp run quality`                                   | Run cacheable Vite+ quality checks       |
| `vp run unit`                                      | Run cacheable Vite+ unit tests           |
| `vp run auth:generate`                             | Generate Better Auth's Drizzle schema    |
| `vp run db:generate`                               | Generate Drizzle SQL migrations          |
| `vp run db:up`                                     | Convert Drizzle migrations to v1 layout  |

`vp run build` previews the Alchemy stack rather than invoking standalone
`astro build`; `Cloudflare.Website.Astro` performs the Cloudflare-aware Astro
build as part of `alchemy deploy`.

## Integration Endpoints

- Better Auth: `/api/auth/*`
- oRPC: `/rpc/*`
- Protected app: `/app/*`
