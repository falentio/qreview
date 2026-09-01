## Toolchain

- Use Vite+ as the project command surface. Run `vp check`, `vp test`, `vp fmt`, `vp lint`, and `vp run` instead of invoking their underlying tools directly.
- Use `vp install`, `vp add`, `vp remove`, `vp update`, and related Vite+ package commands for dependency management. They use the pinned pnpm version in `package.json`.
- pnpm is the only package manager for this repository. Keep `pnpm-lock.yaml`; do not create npm, Yarn, or Bun lockfiles or use those package managers.
- Use `vp run <script>` for `package.json` scripts, including Astro, Wrangler, Drizzle, and Better Auth commands.
- This is an Astro application. Use `vp run dev`, `vp run build`, and `vp run preview`; the built-in `vp dev`, `vp build`, and `vp preview` commands target plain Vite and are not application commands here.
- Use Vite+ task names from `vite.config.ts` when a cacheable workflow is appropriate. Task definitions may invoke project binaries directly so Vite Task can track them. Do not cache development servers, deployments, or database migrations.
- Run `vp` commands sequentially unless a task explicitly declares safe parallelism.
- Use `vp env` and `vp node` for the Vite+-managed runtime. Use `vp exec` for a local binary and `vp dlx` for a temporary binary.

## Validation

- Prefer TDD whenever behavior changes.
- Use sociable unit tests and mock repositories only. Configure typed repository fixtures with `vitest-mock-extended`.
- Run checks narrowly while iterating: use `vp fmt <paths>`, `vp lint <paths>`, or `vp check --no-fmt --no-lint` for type-only validation. Run the full Vite+ checks before completion.
- Read `docs/agents/lint-format.md` when a focused formatting or linting fix is needed.

## Code Conventions

- Use `src/lib/utils.ts` for utilities shared within this application. Create a `packages/utils` workspace package only when multiple packages need to share code.
- The API module owns one reusable aggregate oRPC implementer for server-supported resources: create it with `implement({ ... }).$context<ApiContext>()`, define resource handlers from its branches, return implemented resource routers from `create<Resource>()`, and let the API composition root assemble those routers.
- Constructors with dependencies receive one named dependency object with explicit property names rather than positional arguments.
- Tautological testing are considered harmfull
- Use subagents to do work with playwright to save our token context window, subagents must output all reusable informations for consequtive playwright subagents, so no redundant explorations.
- If you feel the approaches are not clean/SOLID, you MUST propose alternative approaches using ask tool, let human decide.
- Alchemy's `dev` command does not support `--background`. Keep the dev server running with `vp run dev`, or use shell backgrounding such as `vp run dev > /tmp/qr-dev.log 2>&1 &` when a background process is required.
- We does not has component testing (neither as unit test nor e2e), so smoke test when you did change page/component using playwright

## Third-Party Libraries

- Use Exa or Context7 before interacting with third-party library APIs, configuration, or CLI behavior.
- Never read `node_modules`. Clone source with `--depth=1` into `vendor/{host}/{org}/{repo-name}` when source inspection is required.
- Read vendored source through a subagent and write a reusable summary under `vendor/{host}/{org}/{repo-name}---summary/`.
