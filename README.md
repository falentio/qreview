# QR

QR is an Astro application running on Cloudflare Workers. It uses Cloudflare
D1 with Drizzle ORM, Better Auth, and oRPC.

## Local Setup

1. Install dependencies with `pnpm install`.
2. Create a local `.dev.vars` file from `.dev.vars.example`.
3. Replace the D1 placeholder in `wrangler.jsonc` with the ID from
   `wrangler d1 create qr` before using a remote database.
4. Generate Worker types with `pnpm generate-types`.
5. Generate the Better Auth schema with `pnpm auth:generate`.
6. Generate Drizzle migrations with `pnpm db:generate`.
7. Apply local migrations with `pnpm db:migrate:local`.

## Commands

| Command | Action |
| --- | --- |
| `pnpm dev` | Start the local Worker dev server |
| `pnpm build` | Build the application |
| `pnpm typecheck` | Run TypeScript validation |
| `pnpm test` | Run the test suite |
| `pnpm auth:generate` | Generate Better Auth's Drizzle schema |
| `pnpm db:generate` | Generate Drizzle SQL migrations |
| `pnpm db:migrate:local` | Apply migrations to local D1 |
| `pnpm db:migrate:remote` | Apply migrations to remote D1 |

## Integration Endpoints

- Better Auth: `/api/auth/*`
- oRPC: `/rpc/*`
- Protected example page: `/dashboard`
