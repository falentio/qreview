# Focused Checks

Use Vite+ directly for known files instead of running a repository-wide fix:

```bash
vp fmt src/path/to/file.ts --write
vp lint src/path/to/file.ts
vp check --no-fmt --no-lint
```

Use `vp check` for the final repository-wide format, lint, and type validation.
