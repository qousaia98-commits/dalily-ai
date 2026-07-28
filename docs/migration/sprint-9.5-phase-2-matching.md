# Sprint 9.5 Phase 2 — Matching architecture consolidation

**Scope:** Architecture only. No scoring, ranking, AI behaviour, schema, or API changes.

**Date:** 2026-07-28

## What changed

- `src/domains/matching` is the sole public entry for matching (barrel + adapters)
- `src/domains/matching/client.ts` — client-safe entry (avoids `next/headers` leakage)
- `src/domains/matching/types.ts` / `view-types.ts` — canonical type re-exports
- Adapters: `adapters/engine.ts`, `adapters/ai-bridge.ts`, `adapters/smart-match.ts`
- UI / actions / pages redirected off deep imports of matching-engine and smart-match
- AI matching façade documented as thin bridge (flags / routing / telemetry)
- `docs/architecture/matching.md` added
- Feature-flag aliases for smart matching marked deprecated (runtime OR unchanged)

## Explicitly NOT changed

- Matching weights / signal math
- Newcomer oxygen / scarce pool policy values
- Database migrations / schema
- Action return shapes / API responses
- Physical delete of smart-match (still required by search stack)

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm run verify:foundation
npm run verify:matching-engine
npm run verify:mobile
```
