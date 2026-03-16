# Contexted

Peer matching powered by AI memory — the living context your AI assistant has built about you.

## What is this?

Contexted is a peer-matching experiment. You paste a reviewed excerpt from ChatGPT, Claude, or another AI memory source, the system does a light automatic redaction pass for contact-style details, reads it for recurring themes and tone, and stores a redacted matching profile plus derived summary. Matches happen in scheduled batch "drops." Each match surfaces shared synergy points and a mutual confession prompt — once both sides respond, an anonymous chat opens.

The idea: the accumulated understanding your AI has about you is a surprisingly rich signal for finding people you'd actually connect with.

**Current state:** alpha — actively being built and tested.

## Tech Stack

- **TypeScript** end-to-end (strict mode)
- **Hono** — API framework (runs on Cloudflare Workers, Node locally)
- **React 19** + TanStack Router — SPA frontend
- **Supabase** — Postgres + Auth + Storage
- **pgvector** — vector similarity for matching
- **Zod** — shared validation schemas between API and frontend
- **Vite** — frontend build and dev server

## Project Structure

```
apps/
  api-worker/      Hono REST API (Cloudflare Workers / Node locally)
  web/             React 19 SPA (TanStack Router, Vite)
packages/
  shared/          Zod schemas, enums, state machine, matching algorithms
  db/              SQL migrations (applied to Supabase)
docs/              Product and implementation notes
```

## Getting Started

### Quick start (zero external deps)

```bash
npm install
cd apps/api-worker && npm run dev    # API in-memory mode
cd apps/web && npm run dev           # Vite dev server (separate terminal)
```

The API runs in `APP_MODE=memory` by default — all data lives in-process, no database or services needed, and no local `.env` file is required. The web dev server proxies API calls automatically.

In memory mode, the app does not send real email. After you request a magic link, the UI shows a one-device local sign-in link instead.

### Running with Supabase (full pipeline)

For the complete matching pipeline (embeddings, vector search, drops, chat), you need:

- a Supabase project
- an OpenAI API key for embeddings
- optionally an Anthropic API key for fallback LLM calls
- a local `.env` copied from `.env.example`

The Node dev server now falls back to in-process ingestion when `QUEUE_DISPATCH_URL` and `QUEUE_DISPATCH_TOKEN` are unset, so pasted-memory intake works locally without extra queue infrastructure. The Cloudflare Worker deployment path still expects queue wiring.

1. Copy `.env.example` to `.env` and fill in your Supabase credentials
2. Apply migrations: `npm run db:migrate:test`
3. Run the API in postgres mode: `cd apps/api-worker && APP_MODE=postgres npm run dev`

## What Users Get Immediately

- A live pre-signup review flow that makes manual review explicit before signup
- A derived profile card after processing, even while matching still waits for the next drop

## Feature Status

- **Works in memory mode:** landing flow, local sign-in, preferences, intake processing, waiting room, seeded dev drop endpoints
- **Requires Supabase + provider keys:** real email auth, real persistence, embeddings, full matching pipeline, production deployment
- **Intentionally alpha:** batch drops, evolving matching copy, limited automation around redaction and retention

## Data Handling

- The landing page is explicit that automatic redaction is limited and that manual review is required before submit.
- The client only performs a light automatic redaction pass aimed at contact-style details such as email addresses and phone numbers.
- The backend generates a redacted matching text, derived summary, vibe-check copy, and embedding.
- The project currently stores the redacted matching text and summary as part of the profile used for future drops.
- Do not paste names, employers, exact locations, family details, credentials, or anything you would not want retained in redacted form.
- If you plan to run this with real users, review retention and privacy behavior before production use.

### Running tests

```bash
npm run test              # all tests
npm run test:coverage     # with workspace coverage reports
npm run typecheck         # type checking across all packages
```

## How Matching Works

1. **Intake** — user pastes a reviewed excerpt from their AI memory; the system performs a light redaction pass, extracts themes, and generates a vector embedding
2. **Drop** — a scheduled batch job retrieves top-K candidates by vector similarity, then runs an LLM pass for compatibility scoring
3. **Reveal** — matched pairs see synergy points and a shared confession prompt
4. **Chat** — once both sides respond to the prompt, an anonymous chat channel opens

Matching is compatibility-first. The system also includes a private-invite loop where successful referrals earn earlier consideration in future drops, but referral priority never overrides match quality.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, testing, and PR guidelines.

## Community

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)

## License

[MIT](LICENSE)
