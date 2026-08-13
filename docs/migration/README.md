# Dalily 2.0 Migration Documentation

**Status:** Official  
**Approach:** Strangler Migration  
**Current sprint gate:** Sprint 9 complete · Sprint 9.5 Phase 1 hygiene applied · await approval before Sprint 10

## Immutable inputs

These documents are **FINAL**. Engineering must not change product philosophy or architecture meaning.

| Document | Path |
| --- | --- |
| Product Specification (index + invariants) | [`../product/psd-invariants.md`](../product/psd-invariants.md) |
| Software Architecture (boundaries) | [`../architecture/sad-boundaries.md`](../architecture/sad-boundaries.md) |
| Migration Report v1.0 | [`./migration-report-v1.md`](./migration-report-v1.md) |
| Engineering Migration Roadmap | [`./roadmap.md`](./roadmap.md) |

## Sprint 0 deliverables

| Doc | Purpose |
| --- | --- |
| [`coding-standards.md`](./coding-standards.md) | Migration coding rules |
| [`env-checklist.md`](./env-checklist.md) | Environment validation |
| [`verify-checklist.md`](./verify-checklist.md) | Minimum verify/smoke set |
| [`legacy-inventory.md`](./legacy-inventory.md) | Modules marked LEGACY |
| [`sprint-0-notes.md`](./sprint-0-notes.md) | What Sprint 0 changed |
| [`sprint-9.5-cleanup-notes.md`](./sprint-9.5-cleanup-notes.md) | Low-risk hygiene (empty dirs, archive scripts) |

## Domain boundaries (code)

Logical SAD services live under `src/domains/*` as **facades/skeletons**.  
Runtime behavior still comes from existing `src/lib/*` until later sprints move ownership.

See [`../architecture/domain-map.md`](../architecture/domain-map.md).

## Rules

1. Keep the app buildable after every sprint.
2. No product behavior change in Sprint 0.
3. Every migration must be reversible via Git.
4. Do not start Sprint 1 without explicit approval.
