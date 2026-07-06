# myapp — Happy Bear SvelteKit app

The SvelteKit application for Happy Bear. Repo-level docs live in
[../README.md](../README.md); the design contract is
[../architecture.md](../architecture.md).

## Scripts

```bash
npm run dev          # dev server (reads .env)
npm test             # svelte-kit sync + vitest run
npm run lint         # prettier --check + eslint
npm run check        # svelte-kit sync + svelte-check
npm run build        # production build
npm run db:generate  # drizzle-kit generate (after editing src/lib/server/tutor/schema.ts)
```

## Layout

- `src/lib/pedagogy/` — framework-free tutoring core: skills, FSRS mastery,
  dialogue policy, fraction verifier. No Svelte/SvelteKit/DB imports
  (guard-tested).
- `src/lib/server/tutor/` — Drizzle schema + repos, persona.md, prompt
  builder, LLM client, tools, safety hook, streaming turn loop.
- `src/lib/voice/` — STT/TTS interfaces, Web Speech implementations, server
  stubs.
- `src/routes/` — `/` companion, `/tutor`, `/parent`, `api/tutor/*` (SSE
  turn endpoint), legacy `api/chat|session|interact`.
- `drizzle/` — generated migrations (checked in). `data/` — local SQLite.
