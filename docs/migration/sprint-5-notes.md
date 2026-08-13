# Sprint 5 Notes — Unlock Service

**Status:** COMPLETE — approved; Payment = Sprint 6  
**Feature flag:** `UNLOCK_V2` (default **off**)  
**Dev-only grant bypass:** `UNLOCK_DEV_BYPASS` (forced **off** in production configs)

## Goal

Unlock Aggregate after customer select: session + SLA, decline/timeout fallback, **contact_release_grant**. No real payment charge (Sprint 6). No chat authorization expansion (Sprint 7).

## Architectural decisions

1. **`UNLOCK_V2` default off** — select still creates `pending_unlock` without session/grant when unset.
2. **Session opens on select** — `selectOffer` → `openUnlockSessionForSelection` (idempotent `selection:<id>`).
3. **Fail-closed grants** — `contact_release_grants` only via:
   - `UNLOCK_DEV_BYPASS` (local/preview only), or
   - audited `adminConfirmUnlockAction` (`manual_confirm:<userId>` in `payment_stub_ref`), or
   - future Sprint 6 payment capture (`completeUnlockFromPaymentCapture` currently returns `payment_integration_pending`).
4. **No `service_requests.provider_id` bind** — unlock does not open chat; Sprint 7 consumes grant.
5. **Contact gate** — `getReleasedContactForCustomer` requires grant under session RLS, then admin-hydrates provider PII.
6. **SLA cron** — `POST/GET /api/cron/unlock-sla` (+ optional `CRON_SECRET`); `processUnlockSlaTimeouts` is idempotent.
7. **Fallback once** — claim `fallback_applied` first; pick next `superseded` offer → new selection + session.
8. **Reliability signals** — insert `declined` / `timed_out` rows; no reputation scoring yet.
9. **Payment port stub** — `UnlockPaymentPort` / stub returns null; no fake payment success.
10. **Fee snapshot** — `UNLOCK_FEE_AMOUNT` / `UNLOCK_FEE_CURRENCY` / `UNLOCK_SLA_HOURS` frozen on session open.
11. **Writes via admin client** — RLS SELECT only for customer/provider/admin; no authenticated INSERT policies.

## Files

- `src/domains/unlock/*`
- `src/actions/unlock.actions.ts`
- `src/app/api/cron/unlock-sla/route.ts`
- `/business/unlock`, `/business/unlock/[sessionId]`
- Waiting Room unlock status + released contact
- `supabase/migrations/20260725210000_sprint5_unlock_service.sql`

## Acceptance criteria

- [x] Selection opens unlock session + SLA
- [x] Success path creates grant
- [x] Timeout triggers fallback once (idempotent)
- [x] Decline triggers fallback + reliability signal hook
- [x] No chat/phone without grant
- [x] Build/typecheck/lint/`verify:unlock` green
- [x] Grant without payment only behind `UNLOCK_DEV_BYPASS` / admin manual confirm (never prod bypass)

## Rollback

1. Unset `UNLOCK_V2` (and `UNLOCK_DEV_BYPASS`)
2. Disable cron hitting `/api/cron/unlock-sla`
3. Revert Sprint 5 commits
4. Additive tables may remain unused

## Apply DB migration

```bash
supabase db push
# or apply 20260725210000_sprint5_unlock_service.sql
```
