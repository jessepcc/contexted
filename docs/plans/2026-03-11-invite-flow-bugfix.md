# Fix Invite Flow Bugs from E2E Test

**Date:** 2026-03-11
**Branch:** `deploy/cloudflare-setup`
**Status:** ALL DONE

## Bug #1: Invite click tracking broken in production — DONE

**File:** `apps/web/src/referrals.ts` (line 104)
**Root cause:** `trackInviteClick()` used bare `fetch('/v1/...')` without `API_BASE`. In production, the request goes to web origin instead of API origin, returning 503.
**Fix:** Replaced bare `fetch` with `apiRequestRaw()` which prepends `API_BASE`.

## Bug #2: Rate limit error surfaced as HTTP 500 — DONE

### adapters.ts change
**File:** `apps/api-worker/src/adapters.ts`
- Added `import { ApiValidationError } from '@contexted/shared'`
- `sendMagicLink()` now checks `response.error.status === 429` and throws `ApiValidationError` with status 429 instead of generic `Error`
- Other errors still throw generic `Error` (caught as 500 by `withAppErrors`)

### LoginPage.tsx change
**File:** `apps/web/src/pages/LoginPage.tsx`
- Catch block now checks `err.status === 429` and shows friendly message: "Too many requests — wait a moment, then try again."
- Other `HttpError` statuses still show the server message

### Verification
- `npm run build` — passes
- `npm run typecheck` — passes
- `npm run test` — all 83 tests pass

## Step 0: Configure Resend SMTP in Supabase — DONE

### Completed 2026-03-13
- Created new Resend account (`[project email]`) with `contexted.app` domain (verified)
- Created API key `supabase-smtp` (sending access only, scoped to `contexted.app`)
- Configured Supabase SMTP via Management API (dashboard button wasn't responding):
  - Sender: `noreply@contexted.app` / "Contexted"
  - Host: `smtp.resend.com`, Port: `465`
  - Username: `resend`, Password: Resend API key
  - Rate limit increased to 30 emails/hour (auto-applied with custom SMTP)
- DNS records (DKIM, SPF) still showing as pending in Resend — may need Cloudflare auto-configure or manual DNS entry
