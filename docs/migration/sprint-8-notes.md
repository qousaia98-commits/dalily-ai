# Sprint 8 Notes — Provider Dashboard Migration

**Status:** COMPLETE — awaiting approval before Sprint 9  
**Feature flag:** `PROVIDER_DASHBOARD_V2` (default **off**)

## Goal

Unlock-first Provider Home: P0 Unlock SLA, opportunities with why-matched, offer-primary nav, insights without subscription paywall for opportunities.

## Architectural decisions

1. **`PROVIDER_DASHBOARD_V2` default off** — legacy Provider Success home unchanged when unset.
2. **Aggregate only** — `getProviderDashboardHome` reuses Unlock / Offer / settings / reliability signals; no duplicated unlock/payment/chat rules.
3. **Tenant isolation** — all queries filter `provider_id` owned by authenticated business user; request titles hydrated after assignment/grant ownership checks.
4. **No contact PII on dashboard** — unlock/jobs links only; phones stay behind grant contact-gate.
5. **Why-matched** — `match_assignments.reason_codes` surfaced on list/detail/home (no subscription codes).
6. **Pause + emergency honesty** — `vacation_mode` / `accepting_requests` already gate matching; additive `handles_emergency` excludes opt-out providers from emergency pools.
7. **Subscription de-emphasized** — sidebar/mobile put Unlock + Opportunities first; nav label `plan` (tools), not primary upgrade CTA. Opportunities remain ungated by plan.
8. **Offer composer polish** — template quick chips (reuse `offer_templates`).
9. **Accept-for-chat** — not pushed on v2 home; opportunities copy remains “no accept required”.

## Mobile-first P0 notifications (documented)

Priority when `PROVIDER_DASHBOARD_V2` is on:

| Priority | Event | Deep link | Channel |
| --- | --- | --- | --- |
| **P0** | Unlock session opened / payment pending (SLA) | `/business/unlock/[sessionId]` | In-app marketplace notification + Unlock nav |
| **P1** | New match assignment / opportunity | `/business/opportunities/[assignmentId]` | In-app + Opportunities feed |
| **P2** | Offer clarification from customer | Opportunity detail | Q&A section on home |
| **P3** | Unlock succeeded / chat available | `/business/messages/...` | Existing unlock_granted / chat paths |

Mobile bottom nav (flag on): Home → Opportunities (or Requests) → Messages → Unlock (or Growth) → Account. Subscription is **not** required to open opportunities.

## Acceptance criteria

- [x] Dashboard shows Unlock SLA as highest priority when present
- [x] Incoming requests show why-matched
- [x] Offer path primary; accept-for-chat not promoted for v2 home
- [x] Subscription page not required for opportunities
- [x] Mobile-first P0 notifications documented (this file)
- [x] typecheck / lint / `verify:provider-dashboard` green

## Rollback

1. Unset `PROVIDER_DASHBOARD_V2`
2. Revert Sprint 8 UI commits if needed
3. Additive `handles_emergency` may remain (default true = legacy matching)

## Apply DB migration

```bash
supabase db push
# 20260725240000_sprint8_provider_dashboard.sql
```
