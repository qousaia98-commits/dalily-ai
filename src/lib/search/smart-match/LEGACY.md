# LEGACY (salvage host) — directory browse only

Smart-match **ideas** (dynamic radius / explainability) were adapted into
`src/domains/matching` (Sprint 3) **without** premium/subscription reasons.

## Sprint 9.5 Phase 2

- Still required by `src/lib/search/*` (search-engine, ranking-engine, mapper).
- UI / actions / pages must import via `@/domains/matching` adapters
  (`adapters/smart-match.ts`), not deep paths into this folder.
- Not moved under `src/legacy/` yet because search internals still depend on it;
  treat this directory as the legacy compatibility host.

## Remaining dependents (internal search stack)

- `src/lib/search/search-engine.ts`
- `src/lib/search/ranking/ranking-engine.ts`
- `src/lib/search/mapper/provider-list-mapper.ts`
- Domain adapter: `src/domains/matching/adapters/smart-match.ts`

Do **not** call this module from the marketplace match path
(`runMatchingForRequest` / match_pools).
Do not use this module to broadcast requests or apply subscription boosts.
