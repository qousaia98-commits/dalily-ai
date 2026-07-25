# Verify / Test Baseline Checklist

Sprint 0 establishes the **minimum** verification set. Deeper E2E of unlock flows belongs to later sprints.

## Automated (every PR / sprint end)

```bash
npm run verify:foundation
npm run verify:matching
npm run verify:offers
npm run verify:unlock
npm run verify:payments
npm run verify:chat
npm run verify:provider-dashboard
npm run lint
npm run typecheck
npm run build
```

Optional existing scripts (legacy search — still valid while directory exists):

```bash
npm run verify:search
```

## Sprint 8 provider dashboard notes

- Flag off ⇒ legacy Provider Success home.
- Flag on ⇒ Unlock SLA P0 → opportunities (why-matched) → Q&A → active jobs.
- Matching respects `vacation_mode`, `accepting_requests`, and `handles_emergency`.
- Subscription not required for opportunities; nav de-emphasizes upgrade CTA.

## Sprint 7 chat notes

- Flag off ⇒ legacy status-based `canChat()`.
- Flag on ⇒ full chat requires `contact_release_grants` with chat scope (lifecycle ≥ 2); legacy dual-run for lifecycle < 2.
- Q&A stays in `offer_clarifications` (pre-unlock).
- Public directory phone/WhatsApp hidden when flag on.
- Soft-break: migration backfills grants for in-flight status-unlocked conversations.

## Sprint 6 payment notes

- Flag off ⇒ Sprint 5 unlock paths only (no fee capture).
- Grant only after admin approve of `purpose=unlock_fee` or verified webhook `payment.succeeded`.
- Webhook retries: UNIQUE(`provider`,`external_event_id`).
- Subscription upgrades frozen when `UNLOCK_PAYMENTS_V2` is on.

## Manual smoke (Sprint 0 — behavior unchanged)

Perform on local or staging after foundation merges:

1. **Marketing:** open `/` (default locale `ar`, RTL).
2. **Auth pages:** `/login`, `/register`, `/register/business` render.
3. **Public search (legacy):** `/search` loads (directory still present).
4. **Business shell:** `/business` redirects correctly when logged out / accessible when business.
5. **Admin shell:** `/admin` guarded.
6. No console/build errors introduced by domain facade files.

## What Sprint 0 does *not* require

- New unit test framework adoption
- Unlock/payment E2E
- Matching pool tests
- Deleting legacy routes

## Recording results

Note date + pass/fail in `sprint-0-notes.md` when completing the sprint gate.
