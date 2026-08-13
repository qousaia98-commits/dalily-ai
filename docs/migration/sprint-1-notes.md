# Sprint 1 Notes — Marketplace Domain

**Status:** COMPLETE — awaiting approval before Sprint 2  
**Feature flag:** `MARKETPLACE_DOMAIN_V2` (default **off**)

## Goal

Introduce Marketplace as the SAD owner of request lifecycle meaning, with an anti-corruption layer over legacy `service_requests`, without changing chat/payment product behavior.

## Architectural decisions

1. **Flag default off** — production UX identical to pre-Sprint-1 when unset.
2. **Writes stay legacy** — actions still mutate `service_requests` / RPCs; only touch projections when flag on.
3. **Reads enrich only when flag on** — `ServiceRequestDetail.marketplace` meta attached via repository; UI ignores unknown fields safely.
4. **In-memory mapping always available** — works even before SQL migration is applied; projection upsert is best-effort.
5. **Selection table is placeholder** — no product UI uses it until Sprint 4/5.
6. **`canChat()` unchanged** — contact economics remain legacy until Sprint 7 (SAD/PSD).

## Files

- `src/lib/config/feature-flags.ts`
- `src/domains/marketplace/*` (lifecycle, legacy-map, projection, repository, types)
- `src/lib/service-requests/queries.ts` / `types.ts` (thin wire)
- `src/actions/service-request.actions.ts` (thin write adapter)
- `supabase/migrations/20260725140000_sprint1_marketplace_domain.sql`
- `src/types/database.types.ts` (additive types)

## Acceptance criteria

- [x] Marketplace owner module exists; legacy writes still work
- [x] Flag off: identical detail shape (no `marketplace` field)
- [x] Flag on: read path attaches marketplace meta without breaking detail pages
- [x] No chat/payment semantic change
- [x] Build/typecheck/lint green

## Rollback

1. Ensure `MARKETPLACE_DOMAIN_V2` unset/false
2. `git revert` Sprint 1 commits
3. Optional: keep additive SQL (nullable/harmless) or down-migrate manually

## Apply DB migration

```bash
# when ready on a Supabase project
supabase db push
# or apply 20260725140000_sprint1_marketplace_domain.sql in SQL editor
```
