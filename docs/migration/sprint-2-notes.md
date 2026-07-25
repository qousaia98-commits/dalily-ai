# Sprint 2 Notes — Customer Request Flow

**Status:** COMPLETE — awaiting approval before Sprint 3  
**Feature flag:** `CUSTOMER_INTENT_FLOW_V2` (default **off**)

## Goal

Intent → Fast Intake → Publish → Waiting Room behind a flag, without making Directory the primary path for flag-on cohorts.

## Architectural decisions

1. **Flag-gated home** — SearchHero/CategoryGrid/FeaturedProviders remain when flag off; IntentHero when on (no provider lists in intent path).
2. **`provider_id` nullable for `lifecycle_version >= 2`** — SAD conflict with legacy NOT NULL resolved in favor of marketplace-native publish (Migration Report / SAD). Matching assigns providers in Sprint 3.
3. **Reuse problem detection** for category suggestion — no new AI product features; diagnosis wizard not required in the 60s path.
4. **Auth at publish** — intake can start logged out; publish requires login (PSD).
5. **Waiting room honest empty** — offers/matching not built yet; empty/loading/error states exist without faking abundance (Economy Ch.4).
6. **Legacy createServiceRequestAction untouched** — directory RFQ path preserved.

## Acceptance criteria

- [x] Flag on: intent → category confirm → optional photos → location → publish
- [x] Trust copy visible
- [x] Waiting Room empty/loading/error
- [x] Flag off: legacy home/search unchanged
- [x] No public provider lists inside new flow

## Rollback

1. Unset `CUSTOMER_INTENT_FLOW_V2`
2. Revert Sprint 2 commits
3. Additive SQL may remain (nullable provider_id + columns are backward compatible with v1 rows)
