# Sprint 6 Notes — Payment Integration (Unlock Fee)

**Status:** COMPLETE — awaiting approval before Sprint 7  
**Feature flag:** `UNLOCK_PAYMENTS_V2` (default **off**; requires `UNLOCK_V2` for grants)  
**Payment rail:** existing manual bank-transfer + admin approval (no new PSP invented)

## Goal

Correlate **verified server-side payment success** → `contact_release_grants`. Freeze new subscription upgrade checkout. No Chat/Reviews changes.

## Architectural decisions

1. **`UNLOCK_PAYMENTS_V2` default off** — Sprint 5 bypass/manual paths remain when unset.
2. **Additive `payments.purpose`** — `subscription` | `unlock_fee`; no subscription table drops.
3. **Link `payments.unlock_session_id` ↔ `unlock_sessions.payment_id`** — capture is relational, not client state.
4. **Single capture path** — `captureUnlockFeePayment` marks paid then calls `completeUnlockSuccess({ mode: "payment_capture" })` only if DB shows `paid` + matching session/provider.
5. **Admin approve branches** — unlock_fee → capture; subscription → legacy `activateAfterPayment`.
6. **Webhook ledger** — `payment_webhook_events` UNIQUE(provider, external_event_id) for retries; route `/api/webhooks/payments/[provider]`.
7. **Never trust client** — grant only after admin approval or authenticated webhook event.
8. **Idempotency** — reuse open/paid payment per session; unique partial index; capture re-entry returns existing grant.
9. **Retry** — reject/cancel/fail clears active link; provider can create a new intent.
10. **SLA grace** — sessions with `pending_review` unlock fee are skipped by timeout cron (manual review latency).
11. **Subscription freeze** — upgrade/renew actions return `subscription_upgrades_frozen`; UI banner.
12. **`UNLOCK_DEV_BYPASS` still allowed locally** — never prod; still the only grant-without-payment path.

## Acceptance criteria

- [x] Unlock success only after payment success event (when flag on / prod path)
- [x] Payment fail → retry; SLA grace while pending_review
- [x] Admin can distinguish unlock payments (`purpose` / plan badge `unlock_fee`)
- [x] No new subscription checkout promoted (frozen when flag on)
- [x] Idempotency fixtures documented (`verify:payments`)
- [x] typecheck / lint / verify green

## Rollback

1. Unset `UNLOCK_PAYMENTS_V2`
2. Disable webhook route consumers / unset `PAYMENT_WEBHOOK_SECRET`
3. Revert Sprint 6 commits
4. Additive columns/tables may remain unused

## Apply DB migration

```bash
supabase db push
# 20260725220000_sprint6_unlock_payments.sql
```
