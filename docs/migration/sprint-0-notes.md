# Sprint 0 Notes

**Status:** COMPLETE — awaiting approval before Sprint 1  
**Product behavior change:** None

## What this sprint delivered

1. Official migration docs (PSD invariants, SAD boundaries, report, roadmap, standards, checklists)
2. `src/domains/*` logical service facades/skeletons
3. `LEGACY.md` markers on inventory modules/routes
4. `schema.sql` marked non-source-of-truth
5. README + `.env.example` migration notes
6. `npm run verify:foundation` + GitHub Actions CI workflow

## Verify results

| Check | Result | Date |
| --- | --- | --- |
| `npm run verify:foundation` | PASS (43 paths) | 2026-07-25 |
| `npm run lint` | PASS | 2026-07-25 |
| `npm run typecheck` | PASS | 2026-07-25 |
| `npm run build` | PASS | 2026-07-25 |
| Manual smoke | Routes still generated identically in build output (search/business/admin/subscription present) | 2026-07-25 |

## Acceptance criteria (Roadmap Sprint 0)

- [x] Build + typecheck + lint green
- [x] No intentional product behavior change (facades unused by app routes; legacy routes intact)
- [x] SAD service boundaries documented + folder skeletons/facades exist
- [x] Legacy modules marked `LEGACY`
- [x] Env validation checklist documented
- [x] Test/verify minimum set documented
- [x] Foundation commits separate from later domain sprints

## Rollback

Revert Sprint 0 commits (`chore(migration): sprint-0 ...`). No DB migrations were applied.
