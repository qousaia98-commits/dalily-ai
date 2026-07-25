# Sprint 4 Notes — Offer System

**Status:** COMPLETE — awaiting approval before Sprint 5  
**Feature flag:** `OFFERS_V2` (default **off**)

## Goal

Competing offers from **match assignments** before customer select; legacy quotes dual-run for RFQ; **no PII/chat release** on select (Unlock = Sprint 5).

## Architectural decisions

1. **`OFFERS_V2` default off** — legacy `quotes` path unchanged when unset.
2. **Offers require `match_assignment_id`** — cannot create an offer without an assignment for that provider+request (PSD scarce allocation).
3. **Additive `marketplace_offers`** — do not rename/drop `quotes`; dual-run by `lifecycle_version`.
4. **Reuse `marketplace_selections`** — customer select writes `pending_unlock` + `offer_id` FK; does **not** set `service_requests.provider_id`, does not open conversation, does not release phone/address.
5. **Legacy quote send/accept disabled** when flag on **and** `lifecycle_version >= 2` (action guards + UI `legacyQuotesEnabled`).
6. **Compare ≤3** — UI compare strip capped (`OFFER_COMPARE_MAX`); list may show more sent offers.
7. **Structured Q&A** — `offer_clarifications` (max 8, 500 chars) — not chat; no notification domain changes for Q&A.
8. **Templates** — `offer_templates` for &lt;60s compose; not ranking/visibility boosts.
9. **Quality flags** — soft nudges (`thin_pitch`, `missing_eta`, …); do not block submit.
10. **Provider surface** — `/business/opportunities` (flag-gated nav); Waiting Room remains Sprint-3 compatible and gains offer board when offers exist.
11. **Selection ≠ Unlock** — status `pending_unlock` is a stub for Sprint 5; customer copy states contact not released.
12. **Opportunity RLS hydrate** — `listProviderOpportunities` / `getOpportunityDetail` confirm `match_assignments` under the user session, then hydrate `service_requests` via admin. Legacy `service_requests_provider_select` required `provider_id`, which is null on v2; additive policy also allows assigned providers.

## Hotfix (Sprint 4 testing)

**Symptom:** Customer publishes; `/business/opportunities` empty for assigned providers.

**Break point:** Matching created pools/assignments correctly. Opportunities query then loaded `service_requests` with the user client; RLS hid v2 rows (`provider_id` null) → empty list.

**Fix:** Admin hydrate after assignment ownership check + additive RLS migration `20260725195000_sprint4_fix_provider_opportunity_rls.sql`.

### Hotfix 2 — publish fails after RLS migration (42P17)

**Symptom:** UI `publish_failed` / «تعذر نشر الطلب».

**Runtime (authenticated insert):**
- code: `42P17`
- message: `infinite recursion detected in policy for relation "service_requests"`

**Break point:** During `service_requests` INSERT … RETURNING (before matching). Policy from `20260725195000` read `match_assignments`, whose RLS reads `service_requests` again.

**Fix:** `20260725200000_sprint4_fix_service_requests_rls_recursion.sql` — SECURITY DEFINER helper for assignment ownership (no recursive RLS).

## Files

- `src/domains/offer/*`
- `src/actions/offer.actions.ts`
- `src/components/customer/customer-offer-board.tsx`, waiting-room wire
- `src/components/business/offer-composer.tsx`, opportunities pages
- `supabase/migrations/20260725190000_sprint4_offer_system.sql`
- Guards in `service-request.actions.ts` + `request-workflow-panel.tsx`

## Acceptance criteria

- [x] Assigned provider can submit offer without accept-as-chat-key
- [x] Customer sees multiple offers; compare ≤3
- [x] Select creates selection record; **no PII release**
- [x] Legacy quote accept/send path disabled when flag on for v2 requests
- [x] Structured Q&A limited; full chat blocked for v2 when offers flag on

## Rollback

1. Unset `OFFERS_V2`
2. Revert Sprint 4 commits
3. Additive tables may remain unused

## Apply DB migration

```bash
supabase db push
# or apply 20260725190000_sprint4_offer_system.sql
```
