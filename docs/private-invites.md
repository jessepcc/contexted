# Private Invites

This document describes Contexted's private-invite acquisition loop: the backend data model, API contract, queue semantics, and frontend handoff through auth.

## Product Behavior

- Existing authenticated users get a private invite link.
- A recipient can open the link, move through landing → magic link → verify → app, and have the invite attached quietly in the background.
- If that recipient completes intake and successfully joins the waitlist, both sides receive earlier consideration in a future drop.
- This is intentionally not a public referral leaderboard or a hard submission gate.

## Backend Contract

### `GET /v1/referrals/me`

Returns the authenticated user's invite state:

```json
{
  "invite_url": "https://app.example.com/?invite=ABCDEFGH",
  "invite_code": "ABCDEFGH",
  "landed_referrals": 1,
  "max_landed_referrals": 2,
  "available_priority_credits": 1,
  "remaining_referral_rewards": 1,
  "can_invite": true
}
```

Notes:

- Invite codes are lazily created server-side.
- `invite_url` is derived from the request origin.

### `POST /v1/referrals/claim`

Body:

```json
{
  "invite_code": "ABCDEFGH"
}
```

Response:

```json
{
  "claimed": true,
  "eligible_for_reward": true,
  "reason": null
}
```

Behavior:

- Invite codes are normalized to uppercase.
- Self-referrals are rejected.
- Repeated or ineligible claims return a simple explicit payload instead of requiring special frontend branching.

### `POST /v1/referrals/:invite_code/click`

Public tracking endpoint for landing-page opens from an invite link.

Success response:

```json
{
  "clicked": true
}
```

## Qualification and Rewards

- Invite qualification is evaluated during `/v1/waitlist/enroll`.
- The invitee must be a net-new queued participant.
- Each successful referral creates:
  - one inviter priority credit
  - one invitee priority credit
- Reward cap: two landed referrals per inviter in the current alpha.

## Queue and Matching Semantics

- `users.queue_entered_at` is set on first successful waitlist entry.
- Matching remains compatibility-first.
- Priority credits only change first-pass user ordering:
  1. users with available credits first
  2. older `queue_entered_at`
  3. deterministic `user_id`
- Credits are consumed only after a drop publishes successfully.
- Failed or unpublished drops do not consume credits.

## Frontend Flow

- Landing stores `?invite=...` locally and fire-and-forget tracks the click.
- Login preserves the invite through the magic-link `redirect_to`.
- Verify restores the invite after auth.
- App gateway claims any pending invite without changing bootstrap behavior.
- Waiting and expired pages fetch invite state from `GET /v1/referrals/me` and render the private-invite card.

Fallback behavior:

- Claim failures that are non-retriable clear the stored invite and let the app continue normally.
- Temporary API failures keep the pending invite around and degrade the UI softly instead of breaking the page.

## Validation

Useful commands after changes:

```bash
npm run test --prefix apps/api-worker
npm run build --prefix apps/api-worker
npm test --prefix apps/web -- auth.test.tsx referrals.test.ts intakeDraft.test.ts
npm run typecheck --prefix apps/web
npm run build --prefix apps/web
```
