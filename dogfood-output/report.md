# Dogfood Report: Contexted

| Field | Value |
|-------|-------|
| **Date** | 2026-03-13 |
| **App URL** | http://127.0.0.1:5200 |
| **Session** | contexted-e2e |
| **Scope** | Full E2E: onboarding, referral, submit, match, queue, chat |

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 2 |
| Low | 0 |
| **Total** | **2** |

## Issues

### ISSUE-001: Chat messages not loaded on initial page mount

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | functional |
| **URL** | http://127.0.0.1:5200/app/chat |
| **Repro Video** | N/A |
| **Status** | FIXED |

**Description**

When a user navigates to the chat page, existing messages from the partner are not displayed until either: (a) the user sends their own message, or (b) the polling interval fires (5s foreground, 30s background). The root cause is that `usePolling` starts with a `setTimeout` delay before the first tick, and `loadMessages()` was never called synchronously after `loadMatch()`.

**Fix Applied**

Added `await loadMessages()` after `loadMatch()` in the `useEffect` mount handler in `ChatPage.tsx:95-103`. Messages now appear immediately when the chat page opens.

**Repro Steps**

1. User 2 sends a message in the chat
2. User 1 navigates to /app/chat
   ![Before fix](screenshots/06-user1-chat.png)
3. **Observe:** Empty state shown ("You're in. Start with the overlap that felt real.") despite messages existing in the API

4. After fix, reload the same page
   ![After fix](screenshots/06-user1-chat-fixed.png)
5. **Observe:** Messages appear immediately on load

---

### ISSUE-002: Dev mode tokens break chat message alignment

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | functional |
| **URL** | http://127.0.0.1:5200/app/chat |
| **Repro Video** | N/A |
| **Status** | FIXED |

**Description**

In memory/dev mode, the seeded auth tokens (e.g., `dev-token`, `token-user1`) are plain strings, not JWTs. The frontend's `getViewerIdFromToken()` in `auth.ts` attempts to decode the JWT payload to extract the user ID (`sub` claim). With non-JWT tokens, this always returns `null`, causing `isMine` in the chat to be `false` for all messages. Both user's and partner's messages appear left-aligned with the same styling, making it impossible to distinguish who sent what.

**Fix Applied**

Modified `dev-server.ts` to generate JWT-like tokens using `Buffer.from().toString('base64url')` with proper `{"sub":"...","email":"..."}` payloads. The `getViewerIdFromToken()` function now correctly extracts the user ID in dev mode.

**Repro Steps**

1. Open chat with old plain-text dev tokens
   ![Before fix](screenshots/06-user1-msg-sent.png)
2. **Observe:** Both messages are left-aligned (all appear as "theirs")

3. After fix, reload with JWT-like tokens
   ![After fix](screenshots/07-chat-alignment-fixed.png)
4. **Observe:** User's message right-aligned with accent background, partner's left-aligned

---

## E2E Flow Verification

All core flows were tested end-to-end and work correctly:

| Flow | Status | Notes |
|------|--------|-------|
| Landing page | Pass | Memory paste, copy prompt, step indicators all work |
| Login (magic link) | Pass | Email validation, form submission, "check inbox" page |
| Auth verification | Pass | Token extraction from hash, localStorage persistence |
| App gateway routing | Pass | Correctly routes based on phase + intake draft |
| Memory intake submission | Pass | Draft auto-submitted during preferences flow |
| Preferences | Pass | Gender identity, attraction, age range all functional |
| Waitlist enrollment | Pass | Enrolls user and transitions to waiting state |
| Private invite flow | Pass | Code generated, invite URL works, banner shows for invitee |
| Referral claim | Pass | Invite claimed, priority credits awarded |
| Drop / matching | Pass | Dev trigger-drop endpoint matches compatible users |
| Reveal page | Pass | Synergy points, confession prompt, timer all display |
| Confession submission | Pass | Idempotency key, version checks, unlock on both confessions |
| Chat | Pass | Messages send/receive, polling works, Enter key sends |
| Chat alignment | Pass | (after fix) Own messages right-aligned with accent color |
