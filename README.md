# Happy-Bear

A teddy-bear AI companion and voice-capable tutor. Chat with Happy Bear for
comfort and company, or switch to tutor mode and learn fractions with a
patient bear that hints before it tells, tracks what you actually know, and
lets parents review every word.

See [architecture.md](architecture.md) for the full design: module
boundaries, data flows, storage schema, latency budget, and what is real vs
stubbed.

## Features

### Tutor (`/tutor`)

- **Dialogue policy, not vibes** — every reply is constrained to an explicit
  move (DIAGNOSE, HINT, PROBE, EXPLAIN, PRACTICE, REVIEW) chosen by a pure
  state machine. EXPLAIN is gated: the bear scaffolds with hints first and
  never answer-dumps while mastery is uncertain.
- **Real learner model** — per-skill mastery via FSRS spaced repetition
  (`ts-fsrs`), a misconception log (e.g. "adds denominators"), and exact
  fraction checking with `mathjs` — no floating-point grading.
- **Voice** — hold the push-to-talk button in Chrome; speech-to-text via the
  Web Speech API, replies spoken sentence-by-sentence as they stream, so
  audio starts before the model finishes. Text chat works everywhere and
  never depends on voice.

### Safety & parent view (`/parent`)

- Guardrails in every system prompt plus an output-check hook that screens
  each sentence before it is shown or spoken; blocked content is replaced
  and the turn is flagged.
- Every turn is persisted. The parent view lists all sessions with flag
  counts and full transcripts. No analytics — transcripts go nowhere except
  the Anthropic API and the local database.

### Companion (`/`)

- The original Happy Bear: emotion-aware chat, an animated bear that reacts
  to pats and hugs, and gentle coaching that remembers what you share.

## Tech stack

- **App:** SvelteKit + Tailwind CSS (TypeScript throughout)
- **AI:** Anthropic API, streaming with tool use (model set by `ANTHROPIC_MODEL`)
- **Pedagogy:** framework-free TS module (`myapp/src/lib/pedagogy`) with its
  own vitest suite — no Svelte imports, enforced by a guard test
- **Storage:** Drizzle ORM + SQLite (`myapp/data/happy-bear.db`); the
  libSQL/Turso and Postgres deploy paths are documented in architecture.md §4
- **Voice:** Web Speech API STT + speechSynthesis TTS behind interfaces;
  server-side Whisper/TTS are documented stubs
- **CI:** GitHub Actions — prettier, eslint, svelte-check-ready tsconfig, 56 vitest tests

## Getting started

```bash
cd myapp
npm install
npm run dev
```

Put your key in `myapp/.env` first:

```bash
ANTHROPIC_API_KEY="sk-ant-..."
# optional, defaults to claude-sonnet-5
ANTHROPIC_MODEL="claude-sonnet-5"
```

Database migrations and the fractions skill seed run automatically on first
use. Voice needs Chrome (mic permission); other browsers fall back to text.

## Development

```bash
npm test        # vitest: policy table, FSRS math, tools, mocked 5-turn integration
npm run lint    # prettier + eslint
npm run check   # svelte-check type gate
npm run db:generate  # regenerate Drizzle migrations after schema changes
```

## Deployment

The app is deployed as a static/SSR build served through **AWS CloudFront**
for fast, globally distributed delivery.

```bash
cd myapp
npm run build
```

Build output is published to an S3 origin and served via the CloudFront
distribution. Configure your S3 bucket and CloudFront distribution, then
upload the build artifacts and invalidate the cache on each release. Note
the tutor requires a server runtime (SSR + SQLite); swap the driver per
architecture.md §4 before hosting it beyond a single machine.
