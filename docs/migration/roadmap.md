# Official Engineering Migration Roadmap (Index)

**Status:** Official  
**Execution rule:** Complete each sprint’s acceptance criteria; keep app buildable; Git-revertible commits.

## Sprint sequence (do not reorder critical path)

| Sprint | Name | Complexity |
| --- | --- | --- |
| **0** | Engineering Foundation | Medium |
| 1 | Marketplace Domain | High |
| 2 | Customer Request Flow | High |
| 3 | Matching Engine | High |
| 4 | Offer System | High |
| 5 | Unlock Service | High |
| 6 | Payment Integration | High |
| 7 | Chat Authorization Migration | High |
| 8 | Provider Dashboard Migration | Medium |
| 9 | Admin Migration | Medium |
| 10 | Cleanup & Legacy Removal | High |
| 11 | Launch Readiness | Medium |

## Critical path

`S0 → S1 → S2 → S3 → S4 → S5 → S6 → S7 → S8 → S9 → S10 → S11`

**Non-compressible integrity chain:** `S1 → S4 → S5 → S6 → S7`

## Sprint 1 scope (complete — gate)

Marketplace Domain strangler:

- Feature flag `MARKETPLACE_DOMAIN_V2` (default off)
- Lifecycle types + legacy anti-corruption map
- Additive DB: lifecycle columns, selections placeholder, projections
- Read enrichment + write projection touch when flag on
- No Sprint 2 customer intent flow yet

See [`sprint-1-notes.md`](./sprint-1-notes.md).

**Do not implement Sprint 2 until explicit approval.**

## Feature flags (future sprints)

Documented in planning; **not introduced as product behavior in Sprint 0**.  
When added later: default off until launch cell readiness.

## Timeline (planning estimate)

Approx. **19–30 weeks** to single-cell launch readiness with 1–2 engineers (from original roadmap). Sprint 0 is foundation only.
