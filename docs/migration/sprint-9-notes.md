# Sprint 9 Notes — Admin Migration

**Status:** COMPLETE — awaiting approval before Sprint 10  
**Feature flag:** `ADMIN_MIGRATION_V2` (default **off**)

## Goal

Align Admin with Economy + Unlock + Trust ops: cell freeze, unlock payment queue, marketplace inspection, audited comps. Subscription admin becomes read-only (removal Sprint 10).

## Architectural decisions

1. **`ADMIN_MIGRATION_V2` default off** — legacy admin (writable subscriptions) unchanged when unset.
2. **Reuse domains** — Unlock payment approve/reject via existing `admin-payment.actions` → `captureUnlockFeePayment`; matching/offers read via admin client inspection; no duplicated capture logic.
3. **`cell_policies` additive** — `frozen` skips matching; `limited_availability` shrinks initial pool; `concierge` is ops flag only.
4. **Audited `admin_comp`** — new unlock success mode; requires reason ≥8 chars; logs `unlock_comp_granted` to `admin_action_logs`; never silent payment bypass.
5. **Authorization** — Platform admin (`admin` role) for writes (cells, comps, unlock queue). Moderators may **inspect** (read-only). Documented below.
6. **Subscription deprecation** — writes return `subscription_writes_frozen`; UI `readOnly` banner. Keep route for day-2 visibility.
7. **No Chat/Payment/Unlock bypass** except audited comp; no contact PII on inspect.
8. **Matching touch is required** — engine checks cell freeze when flag on (explicit AC).

## Moderator vs Admin

| Capability | Moderator | Platform Admin |
| --- | --- | --- |
| Verification, issues, reviews, audit read | Yes | Yes |
| Marketplace inspect (read) | Yes | Yes |
| Unlock payment queue / approve | No | Yes |
| Cell freeze / policy upsert | No | Yes |
| Comp unlock | No | Yes |
| Subscription writes (when flag on) | Frozen | Frozen |
| Broadcasts / categories | No | Yes (unchanged) |

## Acceptance criteria

- [x] Admin can freeze cell and matching skips (`cell_frozen`)
- [x] Unlock payments & timeouts visible (`/admin/unlock-ops`)
- [x] Comp unlock requires audit reason
- [x] Subscription admin not needed for day-2 ops (read-only)
- [x] Moderator vs admin permissions documented
- [x] typecheck / lint / `verify:admin` green

## Rollback

1. Unset `ADMIN_MIGRATION_V2`
2. Revert Sprint 9 commits if needed
3. `cell_policies` may remain; matching ignores when flag off

## Apply DB migration

```bash
supabase db push
# 20260725250000_sprint9_admin_migration.sql
```
