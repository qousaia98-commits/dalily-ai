# Sprint 3 Notes — Matching Engine

**Status:** COMPLETE — awaiting approval before Sprint 4  
**Feature flag:** `MATCHING_V2` (default **off**)

## Goal

Scarce, explainable provider assignment for marketplace-native requests (PSD Matching Principles / SAD Matching), without subscription influence and without using directory ranking for allocation.

## Architectural decisions

1. **`MATCHING_V2` default off** — publish creates the request only; no pools/assignments/notifications when unset. Legacy RFQ visibility unchanged.
2. **Separate tables `match_pools` / `match_assignments`** — do not set `service_requests.provider_id` on v2 rows. Assignment is many-to-one until customer select (Sprint 4/5). Keeps RFQ semantics intact for legacy rows.
3. **Eligibility gates (hard):** `providers.status = active`, `deleted_at` null, matching `category_id`, city (initial), `provider_request_settings.accepting_requests` and not `vacation_mode`. Missing settings row → accepting (legacy create default).
4. **Emergency:** no `accepts_emergency` column yet — emergency boosts **verified** priority via `emergency_priority` reason; does not invent a capability gate. Documented assumption for later provider-capability work.
5. **Expand-on-failure:** if assigned &lt; `minDesiredAssignments` (3), drop city hard gate (`expanded_area` reason), fill up to `expandedMaxAssignments` (15). `expandMatchPool(requestId)` is independently callable.
6. **No subscription / `dalily-ranking` on the match path** — ranking uses verified + rating + review volume + city fit only; newcomers get reserved exploration slots without fake trust.
7. **Salvage, don’t host:** smart-match premium reasons stay LEGACY; Matching owns new reason codes without `premium`.
8. **Notifications:** on assignment, batch-notify provider owners via existing `deliverMarketplaceNotificationsBatch` (`match_assignment`). Provider opportunity UI remains Sprint 8; href points at `/business/requests`.
9. **Publish best-effort matching** — matching failure never fails publish; undersupply is an honest waiting-room state (Economy Ch.4).
10. **Waiting room** — shows notified count when pool has assignments; never fabricates offers (Sprint 4).

## Files

- `src/domains/matching/*` (policy, reasons, eligibility, rank, engine, queries)
- `src/domains/customer/publish-intent.ts` (wire)
- `src/components/customer/waiting-room.tsx` + waiting page
- `src/lib/config/feature-flags.ts`
- `supabase/migrations/20260725180000_sprint3_matching_engine.sql`
- `src/types/database.types.ts`
- `messages/en.json` / `ar.json`
- `scripts/verify-matching-invariants.mjs`

## Acceptance criteria

- [x] Published request (flag on) creates assignments only to eligible providers
- [x] Every assignment carries reason codes
- [x] Subscription tier does not influence assignment
- [x] Expand-on-failure specified and independently callable (`expandMatchPool`)
- [x] Legacy browse ranking untouched (`dalily-ranking` still exists, not on match path)

## Rollback

1. Unset `MATCHING_V2` → no new pools; waiting room falls back to empty/offer-wait copy without assignment summary
2. Revert Sprint 3 commits
3. Additive SQL may remain unused (or drop tables manually if desired)

## Apply DB migration

```bash
supabase db push
# or apply 20260725180000_sprint3_matching_engine.sql in SQL editor
```
