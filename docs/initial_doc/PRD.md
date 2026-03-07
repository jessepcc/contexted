# PRD: CONTEXT
**Tagline:** *Dating based on your AI's memory of you. Zero swiping. Pure latent compatibility.*

---

## 1. Executive Summary

Context is an asynchronous, language-agnostic matchmaking PWA (Progressive Web App). Users upload their exported AI memory (ChatGPT/Claude). We scrub PII, vectorize their core psychological traits, and place them in a global waitlist. Matches are executed in high-density "Batch Drops" twice a week. Matches unlock via a **2+1 guided interaction** (2 synergy points + 1 confession) before opening into anonymous polling-based text chat.

**Strategic Framing: Two Products in One Codebase**
- **Product A (Viral Acquisition):** The Vibe Check — a shareable personality insights card generated from your AI memory. This is a standalone product even if dating fails.
- **Product B (Retention + Revenue):** AI-powered dating matches. Product A funds and feeds Product B. If Product B fails, Product A can stand alone.

**Core Philosophy:**
- **No raw data storage:** The uploaded file is processed and immediately destroyed. Only redacted outputs are retained.
- **High Scarcity:** Matches are events, not commodities.
- **Shareability:** The onboarding process generates a viral asset (the Vibe Check card).
- **Privacy as a feature:** "Unlike dating apps that sell your data, we literally can't — it's deleted the second your vibe is captured."

**MVP Monetization:** One-time purchases (Unhinged Mode $1.99, Friend Compatibility $4.99) on top of a free Vibe Check + match.

---

## 2. The User Journey (The Funnel)

### Phase 1: The Hook & Upload
1. **Landing Page:** Input memory in landing, instructions given
2. **Authentication:** Magic link only (email). No passwords.
3. **Preferences (required):** Before entering the waitlist, user must set:
   - I am: M / F / NB
   - Looking for: M / F / NB / Any
   - Age range: min–max
   - *This is a safety requirement, not a feature.*

### Phase 2: The Viral Artifact
1. **Ingestion & Scrubbing:** The file hits a queue (via Cloudflare Queue → Workflow). PII is stripped by LLM, then a **regex PII post-filter** catches anything the LLM missed (emails, phones, SSNs, names). The raw file is deleted within 5 minutes of successful processing.
2. **The "Vibe Check":** The LLM generates a 3-sentence, brutally honest "psychoanalysis" of the user based on their prompts.
   - *Example:* "You are a stressed B2B SaaS founder who over-indexes on mechanical keyboards and asks Claude to write apologies to your co-founder. Highly neurotic, surprisingly poetic."
3. **The Share Prompt:** We generate a sleek, downloadable image card with the Vibe Check and a watermark: *"Who is my match? context-app.com"*. Card includes countdown to next drop. User shares this while waiting in the pool.
4. **Brain Type Assignment:** Based on upload source (`chatgpt`, `claude`, or `both`), the user gets a "Brain Type" label — fuel for shareable content and culture war engagement.

### Phase 3: The Drop & The 2+1 Match
1. **The Drop:** Countdown hits zero. Users receive an email with the **first synergy point previewed in the email body** (+30-40% CTR): *"An anomaly has been found. Your match is waiting."*
2. **The Reveal:** User clicks the link (resolves to a CDN-served static artifact — zero database queries). They see:
   - **2 Synergy Points:** *Why* the AI paired them (e.g., "You both use AI to debug Python at 3 AM and share a morbid fear of existential risk").
   - **1 Confession Prompt:** A custom-generated question both users must answer to unlock chat.
3. **The Unlock:** User A answers the confession. User B answers. Both have a **4-hour response deadline** — if exceeded, the unresponsive user is re-queued and the active user gets priority in the next drop. Once both submit, answers are revealed and anonymous chat opens.
4. **The Chat:** Polling-based anonymous text chat (5-second refresh foreground, 30-second background). Auto-destructs after 24 hours of inactivity.

---

## 3. Monetization Strategy

**Monetize the Vibe Check, not the match.** The dating match stays free — it's the growth engine.

| Tier | Price | What You Get | Unit Economics |
|------|-------|--------------|----------------|
| **Free** | $0 | Basic 3-sentence Vibe Check + 1 match per drop | ~$0.02/user |
| **Unhinged Mode** | $1.99 one-time | Brutally honest, no-filter extended Vibe Check | 99% margin |
| **Friend Compatibility** | $4.99 one-time | Upload a friend's memory, get compatibility breakdown | 99% margin |
| **Premium** | $9.99/month | 3 matches per drop + priority reranking | Recurring *(post-MVP)* |

**Launch revenue projection:** If 5% of 100k uploaders buy Unhinged Mode = **$10k launch week.**

**Paid waitlist (under consideration):** $4.99 to guarantee a spot in Drop #1 (limited to 10k). 1,000 paid users = $5k Day 0 revenue + validates willingness-to-pay before burning the launch moment.

**MVP scope:** Free tier + Unhinged Mode + Friend Compatibility. Premium subscription deferred to post-MVP.

---

## 4. Growth Strategy

### The Dual Viral Loop

**Loop #1: The Vibe Check Card (Acquisition)**
```
User uploads AI memory
    → Receives shareable Vibe Check card (watermarked: "Who is my match? context-app.com")
    → Card includes countdown to next drop: "Your match drops Sunday. Will you be there?"
    → Friends see card → visit site → upload their own memory
    → Repeat
```
**Target:** >15% of uploaders share their card.

**Loop #2: The Match Story (Retention — Post-Launch)**
```
Two users match and chat 20+ messages
    → Generate "How You Met" card: "Two strangers. One debugged Python at 3 AM.
       The other wrote poetry to their AI. Their vectors aligned."
    → Shareable image drives new signups from INSIDE the product
```

### The ChatGPT vs Claude Gimmick

**Claude Memory Export Play:**
- Direct link to https://claude.com/import-memory in onboarding Step 1.
- Framing: "Step 1: Visit claude.com/import-memory. Step 2: Download your soul. Step 3: Let us find its match."
- ChatGPT: "Settings > Personalization > Memory > Export" with styled GIF tutorial.
- Technical: Dual-parser for both export formats (~4-6 hours dev time).
- Strategic: Teaching users to export AI memories demonstrates the VALUE of memory features to both companies. They might amplify you because you drive engagement with their products.

### The Waiting Room (Between Drops)
Kill the engagement dead zone:
1. **Live counter:** "47,382 minds in the queue" — social proof + FOMO.
2. **Vibe Check of the Day:** Showcase funniest user-submitted cards (opt-in) — daily content.
3. **Compatibility Preview:** "You're more chaotic than 87% of the pool" — shareable, narcissistic, Spotify Wrapped energy.

### Privacy-as-Marketing
> "Unlike dating apps that sell your data, we literally can't — it's deleted the second your vibe is captured."

Lead with this in ALL marketing. Privacy is a feature, not a compliance checkbox.

### Launch Cadence

| Day | Time | Action |
|-----|------|--------|
| **Thursday** | Morning | Newsletter exclusive (Ben's Bites, The Rundown) with 3-5 example Vibe Check card images |
| **Friday** | 6PM EST | Public launch: X/Twitter hook thread + Product Hunt. Share founder's own Vibe Check card. DM 50 founders/influencers with their generated cards. |
| **Saturday** | Midday | Organic spread. Post "ChatGPT Brain vs Claude Brain" infographic. Repost best user-shared cards. |
| **Sunday** | 9PM EST / 6PM PST | Drop #1: "The anomaly has been found." Post results in real-time: "4,000 minds matched in the first hour." |
| **Monday** | Morning | Share best Vibe Check cards (user-consented). "This is what your AI thinks of you." |

**Marketing budget: ~$0-500 total.** Newsletter coverage pitched as news (not sponsored). The product IS the pitch.

---

## 5. Technical Architecture & Stack

### Runtime Components

| Component | Technology | Notes |
|-----------|-----------|-------|
| **Frontend** | React + TanStack Router + Vite, TailwindCSS, Framer Motion | PWA on Cloudflare Pages |
| **Backend / DB** | Supabase (Postgres) | Supavisor in **transaction mode** for connection pooling |
| **Vector Engine** | `pgvector` with `HNSW` index | m=16, ef_construction=128 |
| **AI Pipeline** | Claude Haiku / GPT-4o-mini | Redaction, Vibe Check, synergy/confession generation |
| **Embedding** | `text-embedding-3-small` | Multilingual, 1536 dimensions |
| **Queue / Orchestration** | Cloudflare Workflows + Queues | Durable multi-step pipelines (Workflows) + burst buffering/fan-out (Queues). Native to CF, no external SaaS. |
| **Email** | Resend | Batch drop notifications with synergy preview |
| **Payments** | Stripe | Unhinged Mode + Friend Compatibility |
| **Storage** | Supabase Storage (S3-compatible) | Pre-computed match artifacts (static JSON) |
| **Chat** | Polling-based (5s foreground, 30s bg) | NOT WebSockets — handles 100x concurrent load |
| **Legal** | Termly or Iubenda (~$20/mo) | Privacy policy + TOS |

### Core Architecture Decision: Pre-Compute to Static Storage

**Drop day is a CDN read problem, not a database problem.**

All match results are pre-computed into static JSON files in Supabase Storage BEFORE sending the drop email. The email link resolves to a Cloudflare Worker that reads from storage — zero database queries on drop day.

- Drop day serving cost: **~$0** (S3 reads + CDN)
- Original risk: $500-2000/drop for live LLM reranking
- **Actual cost per drop: ~$55** (matching + LLM content + email)

### Upload Flow

Client uploads → private encrypted staging bucket → Cloudflare Queue (absorbs burst) → Cloudflare Workflow per upload (parse → redact → PII regex filter → embed → persist profile/vibe → delete raw file). User sees "Generating your Vibe Check..." loading state throughout.

---

## 6. Matching Pipeline

The matching pipeline runs as a scheduled job before each drop. LLM is used ONLY to generate content for confirmed pairs, not for candidate ranking.

| Step | Method | Time (50k users) | Cost |
|------|--------|-------------------|------|
| 1. Fetch eligible users | Single Postgres query (`status='waiting'`) | ~1s | $0 |
| 2. Candidate generation | pgvector KNN: top 20 per user, excluding past matches | ~30s | $0 |
| 3. Preference filtering | Gender/orientation/age SQL filter | <1s | $0 |
| 4. Pairing | Deterministic dedup pairing (simple top-1 with dedup Set) | ~5s | $0 |
| 5. Content generation | LLM calls for FINAL pairs only: synergy points + confession prompt | ~20min | ~$5 |
| 6. Pre-render | Write results to Supabase Storage as static JSON per user | ~2min | ~$0.002 |
| 7. Notifications | Resend batch API (50k emails, with synergy preview) | ~1min | ~$50 |

**Total pipeline: ~25 minutes. Total cost: ~$55/drop for 50k users.**

**Cost note:** 25k LLM calls at GPT-4o-mini pricing (~500 input + ~200 output tokens each) = ~$5 total.

**Scaling note:** For Drop #1 (likely <10k users), simple top-1 vector match with a dedup Set is sufficient. Upgrade to Gale-Shapley stable matching algorithm for Drop #3+ when pool sizes justify it.

---

## 7. Database Schema (MVP)

**8 core tables** (full SQL in [implementation tech spec](docs/implementation-tech-spec.md)):

**Table: `users`**
- `id` (uuid, PK), `email` (citext, unique), `status` (enum: waiting, processing, ready, matched, re_queued, blocked, quarantined, failed), `created_at`, `last_active_at`, `deleted_at`

**Table: `profiles`** (1-to-1 with users)
- `user_id` (uuid, FK), `source` (enum: chatgpt, claude, both), `sanitized_summary` (text), `vibe_check_card` (text), `embedding` (vector(1536), HNSW indexed), `embedding_model` (text, default 'text-embedding-3-small'), `pii_risk_score` (int)

**Table: `preferences`** (1-to-1 with users)
- `user_id` (uuid, FK), `gender_identity` (M/F/NB), `attracted_to` (text[]), `age_min` (int, >=18), `age_max` (int)

**Table: `matches`**
- `id` (uuid, PK), `drop_id` (uuid, FK), `user_a_id`, `user_b_id`, `status` (enum: pending_confession, unlocked, expired, closed), `synergy_points` (jsonb, 2 points), `confession_prompt` (text), `user_a_confession`, `user_b_confession`, `response_deadline` (4h), `expires_at` (24h after unlock)

**Table: `messages`**
- Standard chat schema (id, match_id, sender_id, body, created_at, expires_at)

**Table: `reports`** (abuse prevention — required from Day 1)
- `id`, `reporter_id`, `reported_id`, `reason`, `created_at`

**Table: `match_feedback`** (validates core hypothesis: does AI memory predict compatibility?)
- `match_id`, `user_id`, `rating` (1-5), `created_at`

**Table: `shared_vibe_checks`** (viral loop tracking)
- `id`, `user_id`, `share_token` (unique), `platform`, `clicked` (boolean), `created_at`

**Additional tables in tech spec:** `profile_ingestions`, `drops`, `drop_memberships`, `reveal_tokens`, `job_runs`, `outbox_events`, `analytics_events`.

---

## 8. The AI Prompts (The Secret Sauce)

### Prompt 1: Ingestion & Scrubbing

> "You are a strict data-privacy engine. You will receive a user's AI chat memory.
> 1. Strip ALL Personally Identifiable Information (Names, locations, emails, phone numbers, company names, API keys).
> 2. Summarize their core personality traits, deeply held beliefs, recurring anxieties, hobbies, and communication style into a cohesive, anonymous 500-word profile.
> 3. Generate a 3-sentence 'Vibe Check'—a slightly edgy, brutally honest, and highly shareable psychoanalysis of the user."

**Non-negotiable safety net:** After LLM scrubbing, run a **regex PII post-filter** before storage (emails, phones, SSNs, common name patterns). Flag suspicious output for manual review. The LLM may hallucinate and leave PII in the sanitized summary.

**Priority note:** 50% of prompt engineering time should go to Vibe Check quality. A boring Vibe Check kills virality — and if nobody shares, matching quality is irrelevant because nobody reaches it.

### Prompt 2: Pair Content Generation (for confirmed matches only)

> "You are a psychological matchmaker. I will provide User A's profile and User B's profile. These two users have already been matched by our algorithm.
> Generate:
> 1. Two bullet points on why they synergize — focus on complementary personalities who share fundamental worldviews but can challenge each other. We do NOT want exact clones.
> 2. One 'Confession' prompt — a deeply personal, slightly provocative question both users must answer to unlock their chat. Make it hyper-specific to their shared latent traits."

**Key change from original:** LLM is NOT used for candidate reranking. It generates content ONLY for already-matched pairs. This cuts LLM calls from O(n) to O(n/2).

---

## 9. Kill Criteria

Define before launch. If these fail, act immediately.

| Metric | Threshold | What It Means | Action |
|--------|-----------|---------------|--------|
| **Vibe Check share rate** | < 15% of uploaders | Viral loop is broken | Rework Vibe Check prompt; invest in entertainment value |
| **Upload completion rate** | < 40% of visitors who start | Export friction too high | Add video walkthrough; add text-paste fallback |
| **Matched pairs opening chat** | < 30% | Core hypothesis is dead — AI memory doesn't predict compatibility | **Pivot to Vibe Check as standalone personality insights tool** |
| **Gender ratio** | > 75% one gender | Death spiral: underrepresented gender leaves, then everyone leaves | Pause growth, manually recruit underrepresented gender |
| **D7 retention** | < 10% | The "cool demo" problem — people try it once and leave | Build between-drop engagement hooks (waiting room content) |
| **Monthly burn** | > $500 by Month 2 with $0 revenue | Unsustainable | Monetize immediately or shut down dating, keep Vibe Check |

---

## 10. Execution Plan (10 Steps)

| Step | Focus | Deliverables |
|------|-------|-------------|
| **1** | DB + Pipeline | Supabase setup, pgvector + HNSW index, full schema (users, profiles, preferences, reports, match_feedback, shared_vibe_checks), dual parser for ChatGPT + Claude export formats |
| **2** | AI Pipeline | PII scrubbing prompt (Claude Haiku), regex post-filter, Vibe Check generation prompt (calibrate for entertainment > accuracy), embedding pipeline |
| **3** | Matching Engine | Vector similarity search, simple dedup matching, synergy/confession LLM generation for final pairs, pre-compute results to Supabase Storage |
| **4** | Landing Page | TanStack Router + Vite with countdown timer, split-screen ChatGPT/Claude upload UI, Framer Motion animations, dark/light toggle, live "minds in queue" counter |
| **5** | Upload Flow + Vibe Check | File upload → CF Queue → CF Workflow processing → Vibe Check card generation (HTML-to-Canvas), share tracking with unique tokens, Unhinged Mode paywall ($1.99) |
| **6** | Match Reveal + Chat | 2+1 reveal UI (2 synergy points, 1 confession), polling-based anonymous chat (5s refresh), 24h auto-destruct, 4h response timeout, match feedback prompt (1-5 rating) |
| **7** | Email + Auth | Resend integration, magic link auth, drop notification emails with first synergy point preview in email body, configurable cron scheduling |
| **8** | Monetization + Legal | Stripe for Unhinged Mode + Friend Compatibility, Termly/Iubenda for privacy policy + TOS, FAQ page, support autoresponder |
| **9** | Testing + Seeding | Push 10 friends through full pipeline, validate Vibe Check quality (is it screenshot-worthy?), seed 20 influencers with their cards, pitch newsletter exclusive |
| **10** | Launch | Thursday newsletter → Friday 6PM public launch → Saturday organic spread → Sunday 9PM Drop #1 |

---

## 11. Technical Warnings (Must-Fix Before Launch)

| Issue | Risk | Fix |
|-------|------|-----|
| **Edge function timeout** | Large ChatGPT exports (50MB+) can stall during parsing/LLM calls | Queue via CF Queue → Workflow with loading state; keep edge endpoint as thin async trigger |
| **Real-time chat scaling** | Supabase Realtime = 500 concurrent connections on Pro. 25k matches = 50k connections | Polling-based chat (5s refresh) for MVP. Ships in 1 day, handles 100x the load |
| **Connection pooling** | Drop day = thundering herd. Supabase default config will drop connections | Supavisor in **transaction mode** (not session mode) |
| **Upload rate limiting** | Viral spike = 1000+ uploads/min. Edge functions will cascade-timeout | Queue uploads via CF Queue. Show loading state |
| **PII leakage** | LLM may hallucinate and leave names/emails in sanitized_summary | Regex PII post-filter before storage. Flag suspicious output for manual review |
| **Embedding model drift** | OpenAI updates text-embedding-3-small → existing embeddings incompatible | Store `embedding_model` version in profiles table. Re-embed on model change or lock version |
| **Drop time hardcoded** | Pipeline failure = no way to delay the drop | Configurable via environment variable. Kill switch ready |
| **Legal minimum** | GDPR/CCPA exposure if viral in EU | Termly or Iubenda ($20/month) for privacy policy + TOS |

### Post-Launch Technical Debt
- Implement Gale-Shapley stable matching for Drop #3+
- Build real analytics pipeline for Brain Type stats
- Migrate to dedicated realtime provider if chat exceeds polling capacity
- Re-embed all profiles on embedding model version changes
- Incremental checkpointing in matching pipeline (restart from failure point)

---

## 12. Outstanding Decisions

These items were debated by the advisory panel and NOT fully resolved. They require testing or founder decision.

| # | Decision | Status | Trigger |
|---|----------|--------|---------|
| 1 | **Photo Reveal milestone** — after 20+ messages, both opt in to share one photo. Gives anonymous chat a progression mechanic. | Test with Drop #1 users | Add if chat abandonment rate is high |
| 2 | **Text-paste fallback** — allow pasting AI memory text instead of file upload | Do NOT build for MVP | Add only if upload completion rate < 40% |
| 3 | **Paid waitlist** — $4.99 to guarantee Drop #1 spot (limited to 10k) | Under consideration | Validates willingness-to-pay before launch |
| 4 | **Premium subscription** ($9.99/mo) | Deferred to post-MVP | Build after proving free-to-paid conversion on one-time purchases |
| 5 | **Brain Type launch stats** — use test data to generate ChatGPT vs Claude stats for launch infographic | Ethical risk not fully assessed | Founder decision on whether to seed with synthetic data |
| 6 | **Match Story card** — second viral loop, shareable "How You Met" narrative after 20+ messages | Confirmed post-launch | Build after Drop #2 if chat engagement is healthy |
| 7 | **Compatibility API** — $0.01/comparison for developers | Long-term revenue diversification | Revisit after product-market fit |

---

## 13. Panel Feature Roadmap (Post-MVP)

One feature each advisory panelist would add first:

| Panelist | Feature | Why It Matters |
|----------|---------|---------------|
| **Marcus** (Builder) | Photo Reveal milestone — after 20+ messages, both opt in to share one photo | Gives anonymous chat a GOAL and progression mechanic. Without it, chat is a dead-end. |
| **Sarah** (VC) | Referral matches — invite friend → get compatibility score between your matches | Creates network effect. Each user recruits others to improve THEIR experience. This is venture-scale. |
| **Kai** (Growth) | Match Story card — post-match shareable "How You Met" narrative | Second viral loop from inside the product. Two loops > one. |
| **Priya** (Engineer) | Match quality feedback loop — 1-5 rating per chat → fine-tune matching weights | Builds proprietary matching model that improves with data. THIS is the technical moat. |
| **Derek** (CFO) | Compatibility API for developers — $0.01 per comparison | Turns the dating app into a platform. If dating dies, the API survives. |

---

*PRD last updated March 3, 2026. Incorporates advisory panel findings from 5-round moderated discussion (5 expert panelists). Implementation details in [docs/implementation-tech-spec.md](docs/implementation-tech-spec.md). Full panel transcript in [docs/advisory-findings.md](docs/advisory-findings.md).*
