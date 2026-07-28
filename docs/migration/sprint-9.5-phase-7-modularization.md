# Sprint 9.5 Phase 7 — Large file modularization

Maintainability refactor only. Runtime behaviour identical.

## Done

- Split `service-request.actions.ts` → `src/actions/service-request/*`
- Split `intent-intake-flow.tsx` → `src/components/customer/intent-intake-flow/*`
- Classified remaining ≥700 LOC files (see `docs/architecture/modularization.md`)
- Public import paths preserved via barrels/shims

## Deferred

- `provider.actions.ts` (~937 LOC) — same action-module pattern, next maintainability pass
