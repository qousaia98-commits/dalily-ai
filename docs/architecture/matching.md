# Matching Architecture

Sprint 9.5 Phase 2 — architecture consolidation only.  
Matching quality, business rules, AI scoring, DB schema, and API responses are unchanged.

## Architecture

```
UI / Pages / Actions
        ↓
src/domains/matching          ← sole public entry
        ↓
src/lib/matching-engine       ← sole runtime Smart Matching Engine
        ↓
src/lib/ai/matching           ← thin AI bridge (flags, routing, telemetry)
        ↓
Scoring modules (engine signals / legacy score.ts)
        ↓
Database
```

Parallel path (directory browse — not scarce marketplace matching):

```
Search stack (lib/search/*)
        ↓
src/lib/search/smart-match    ← LEGACY host (search internals only)
        ↑
src/domains/matching/adapters/smart-match.ts  ← UI must use this
```

## Flow (marketplace scarce matching)

1. Customer publish / expand → `runMatchingForRequest` / `expandMatchPool`
2. Domain eligibility + policy (`MATCHING_POLICY`, reason codes)
3. Rank path selected by flags:
   - default / `MATCHING_V2` policy rank
   - `AI_ENGINE_V2` → AI bridge `selectAssignmentsWithAiRanking`
   - `AI_ENGINE_V3` → smart dispatch (`lib/ai/dispatch`)
4. When `SMART_MATCHING_ENGINE` is on, the AI bridge routes scoring to `matching-engine`
5. When off, bridge uses legacy `lib/ai/matching/score.ts`
6. Assignments persisted to `match_pools` / `match_assignments`

## Public API

**Server** (Server Components, actions, pages):

```ts
import {
  runMatchingForRequest,
  getMatchPoolSummaryForRequest,
  simulateMatching,
  getAdminMatchingDashboard,
  MATCH_REASON_CODES,
  type MatchReason,
  type AdminMatchingDashboard,
  suggestRequestImprovements,
  fetchCompletedJobsByProviderIds,
  type DirectoryMatchReason,
} from "@/domains/matching";
```

**Client** (`"use client"` modules — required to avoid `next/headers` leakage):

```ts
import {
  suggestRequestImprovements,
  MATCH_REASON_CODES,
  type DirectoryMatchReason,
  type AdminMatchingDashboard,
} from "@/domains/matching/client";
```

Canonical types live in `src/domains/matching/types.ts` / `view-types.ts`.

## Internal Engine

`src/lib/matching-engine` is the only Smart Matching Engine runtime:

- signal collectors, weights, fairness, explanations
- `rankProvidersSmartMatch`, preferences, capacity, admin dashboard
- Other `lib/*` modules that are part of the stack may import it directly
- UI / actions / pages must not

## AI Bridge

`src/lib/ai/matching`:

| Responsibility | Location |
|----------------|----------|
| Façade metadata | `facade.ts` |
| Flag routing + telemetry | `rank-with-ai.ts` |
| Legacy score (flag off) | `score.ts` |
| Future ML routing | dynamic import of matching-engine / future ranker |

Scarce-pool policy (newcomer oxygen, max assignments) remains owned by `domains/matching` policy and is applied inside the bridge call path without changing rules.

## Legacy Adapters

| Adapter | Purpose |
|---------|---------|
| `adapters/engine.ts` | Re-exports matching-engine for the public barrel |
| `adapters/ai-bridge.ts` | Re-exports AI matching bridge |
| `adapters/smart-match.ts` | Compatibility for directory smart-match used by UI |

`src/lib/search/smart-match` remains in place (still required by search-engine / ranking-engine / mapper). It is documented as LEGACY and must not feed the marketplace match path.

## Future ML Integration

- Keep `ML_RANKER_COLLECTOR` / engine hooks as the extension point
- Route new models behind `SMART_MATCHING_ENGINE` (or a dedicated flag) inside the AI bridge only
- Do not add a second public entry point

## Allowed Imports

| From | May import |
|------|------------|
| UI, actions, pages (server) | `@/domains/matching` |
| `"use client"` UI | `@/domains/matching/client` |
| `src/domains/matching/*` | matching-engine, ai/matching, smart-match (via adapters) |
| `src/lib/matching-engine` | its own modules, supabase, flags, observability |
| `src/lib/ai/matching` | domains/matching **leaf** modules (not the barrel), matching-engine |
| `src/lib/search/*` | `src/lib/search/smart-match` (directory browse) |

## Forbidden Imports

| From | Must not import |
|------|-----------------|
| UI / components | `@/lib/matching-engine/**`, `@/lib/ai/matching/**`, `@/lib/search/smart-match/**` |
| Actions | same |
| Pages (App Router) | same |
| Marketplace match path | smart-match (directory) for eligibility / ranking |

Deep imports of `@/domains/matching/reasons` etc. from other domains are discouraged; prefer the barrel unless a leaf import is required to avoid cycles (AI bridge / engine internals).

## Feature Flags

| Canonical | Role |
|-----------|------|
| `MATCHING_V2` | Scarce pool matching domain |
| `SMART_MATCHING_ENGINE` | Modular weighted engine |

Deprecated aliases (still OR’d at runtime — no behaviour change):

- `SMART_MATCHING_ENGINE_V1`
- `AI_SMART_MATCHING`

## File classification (Phase 2)

| Path | Class |
|------|--------|
| `src/domains/matching/*` | Domain API |
| `src/domains/matching/types.ts` | Shared Types |
| `src/domains/matching/adapters/*` | Legacy / Engine / AI adapters |
| `src/lib/matching-engine/*` | Core Engine / Scoring / Ranking |
| `src/lib/ai/matching/*` | AI Bridge (+ legacy score module) |
| `src/lib/search/smart-match/*` | Legacy Smart Match |
| `src/lib/search/ranking/*` | Search Adapter / Ranking |
| `src/lib/dalily-ranking/*` | Legacy directory ranking (browse) |
