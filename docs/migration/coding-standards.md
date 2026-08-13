# Migration Coding Standards

Applies from Sprint 0 onward.

## Compliance

1. Changes must comply with PSD invariants, SAD boundaries, Migration Report, and Roadmap.
2. No new product features outside the active sprint goal.
3. No product behavior changes in Sprint 0.
4. Prefer strangling via facades/flags over big-bang rewrites.

## Ownership

- Put new domain logic under `src/domains/<service>/` once a sprint owns that move.
- Until then, keep implementing in existing `src/lib/*` **or** add facade-only files.
- Never write directly across ownership boundaries (SAD Ch. 5).

## Legacy

- Modules listed in `legacy-inventory.md` must keep a `LEGACY.md` marker.
- Do not extend LEGACY modules with new product capabilities.
- Bugfixes for production safety are allowed.

## Quality gates (every sprint)

- `npm run lint`
- `npm run typecheck`
- `npm run build` (or CI equivalent)
- `npm run verify:foundation` (Sprint 0+ structural checks)

## Git

- Small, logical commits per milestone.
- Conventional commits preferred (`chore`, `docs`, `refactor`, `feat`, `fix`).
- Sprint foundation example: `chore(migration): sprint-0 ...`
- Every sprint must remain revertible.

## Privacy & money (always)

- Fail closed on unlock/payment/PII.
- UI hiding is not authorization.
- Idempotency for selection/unlock/payment/grant/timeouts when those domains exist.

## AI

- Advisory only until domain command accepts user confirmation.
- Never invent prices; never auto-select providers; never release PII.
