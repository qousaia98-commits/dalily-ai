# Sprint 6 Validation Report

**Date:** 2026-07-25  
**Branch:** `migration/dalily-2.0`  
**Scope:** Unlock Fee Payment Integration only — **Sprint 7 not started**

## Executive verdict

**PASS** — automated structural checks green; live DB E2E of unlock payment scenarios **22/22 passed** after enabling `UNLOCK_PAYMENTS_V2` in local env. No code defects found that block Sprint 6 acceptance.

---

## 1. Tests executed

### Automated (repo scripts)

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run verify:foundation` | PASS |
| `npm run verify:matching` | PASS |
| `npm run verify:offers` | PASS |
| `npm run verify:unlock` | PASS |
| `npm run verify:payments` | PASS |
| `npm run validate:sprint6` | PASS (22 assertions) |

### Unit / integration / e2e frameworks

| Suite | Status |
| --- | --- |
| Unit tests (`vitest`/`jest`) | **Not present** in repository |
| Integration test runner | **Not present** — replaced by `scripts/validate-sprint6-unlock-payments.mjs` |
| Browser E2E (`playwright`/`cypress`) | **Not present** |

Machine-readable output: [`sprint-6-validation-report.json`](./sprint-6-validation-report.json)

---

## 2. Passed tests (E2E unlock payment)

| Scenario | Assertion | Result |
| --- | --- | --- |
| Schema | `payments.purpose` / `unlock_session_id` / webhook table / `unlock_sessions.payment_id` | PASS |
| Happy path prep | Request → pool → assignment → offer → selection → unlock session | PASS |
| Security | No grant / no contact hydrate before payment | PASS |
| Security | Anon cannot insert `contact_release_grants` (RLS) | PASS |
| Security | Authenticated customer cannot insert grant (42501) | PASS |
| Failed payment | Status `failed` ⇒ no grant; contact hidden | PASS |
| Cancelled payment | Status `cancelled` ⇒ no grant | PASS |
| Retry | New unlock_fee payment after fail/cancel | PASS |
| Idempotency | Second active pending payment for same session rejected (23505) | PASS |
| Happy path capture | Mark paid + create grant | PASS |
| Happy path contact | Provider phone readable only after grant | PASS |
| Idempotency | Re-capture returns same grant; duplicate grant insert rejected | PASS |
| Webhook | First event insert OK; duplicate `(provider, external_event_id)` rejected | PASS |
| Security | Capture guard refuses unpaid (`pending`) payment | PASS |
| Cleanup | Ephemeral users/providers/requests removed | PASS |

---

## 3. Failed tests

**None** (final run).

Earlier run failed once on fixture (`providers.module_id` NOT NULL) — fixed in the validation script; re-run clean.

---

## 4. Warnings

| Warning | Disposition |
| --- | --- |
| `UNLOCK_PAYMENTS_V2` was unset in `.env.local` during first run | **Fixed** — set `UNLOCK_PAYMENTS_V2=true` locally so product UI uses payment capture path |
| No browser E2E / unit harness | Documented remaining risk (see below) |

Final validate run: **0 warnings**.

---

## 5. Scenario mapping (requested)

1. **Happy path** — covered via fixture chain + capture + contact visible after grant.  
2. **Failed payment** — no grant; contact hidden.  
3. **Cancelled payment** — no grant.  
4. **Retry** — recreate payment after fail/cancel; successful capture unlocks.  
5. **Security** — RLS blocks client grant insert; unpaid capture refused; contact gate requires grant.  
6. **Idempotency** — unique active payment per session; unique grant; webhook event uniqueness.

---

## 6. Remaining risks

1. **No Playwright UI E2E** — receipt upload button / admin approve UI not click-tested; DB + RLS + domain invariants covered.  
2. **Validation script mirrors capture SQL** — does not import Next.js server actions (cookie session). Domain flags/`captureUnlockFeePayment` still covered by `verify:payments` static invariants.  
3. **`UNLOCK_DEV_BYPASS`** — if enabled locally, can still grant without payment (by design; forced off in production configs).  
4. **Manual admin latency** — SLA grace skips timeout while `pending_review`; long admin delays still need ops attention.  
5. **Webhook secret** — production must set `PAYMENT_WEBHOOK_SECRET`; insecure local allow-list only when explicitly enabled.

---

## 7. Local env note

For Sprint 6 product behavior locally, ensure:

```env
UNLOCK_V2=true
UNLOCK_PAYMENTS_V2=true
```

(Payment bank keys already present.)

Re-run anytime:

```bash
npm run typecheck && npm run lint && npm run verify:payments && npm run validate:sprint6
```

---

## 8. Gate

Sprint 6 validation: **APPROVED for engineering readiness** from automated + DB E2E evidence.  
**Do not start Sprint 7 until explicit product approval.**
