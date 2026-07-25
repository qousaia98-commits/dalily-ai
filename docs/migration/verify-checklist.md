# Verify / Test Baseline Checklist

Sprint 0 establishes the **minimum** verification set. Deeper E2E of unlock flows belongs to later sprints.

## Automated (every PR / sprint end)

```bash
npm run verify:foundation
npm run verify:matching
npm run verify:offers
npm run verify:unlock
npm run lint
npm run typecheck
npm run build
```

Optional existing scripts (legacy search — still valid while directory exists):

```bash
npm run verify:search
```

## Sprint 5 unlock notes

- Flag off ⇒ no sessions/grants; select remains `pending_unlock` only.
- Contact PII only via `getReleasedContactForCustomer` after grant.
- SLA worker: `/api/cron/unlock-sla` (protect with `CRON_SECRET` when set).
- Real unlock fee charge is Sprint 6 — do not treat `UNLOCK_DEV_BYPASS` as prod path.

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
