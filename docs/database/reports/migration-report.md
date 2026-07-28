# Migration Report — Sprint 9.5 Phase 8

## Before

- 77 top-level files in `supabase/migrations/`
- Mixed foundation, repair, RLS, sprint, AI, stabilization migrations
- No active baseline for fresh installs

## After

| Location | Contents |
| --- | --- |
| `migrations/archive/` | 77 historical SQL files (immutable) |
| `migrations/baseline/baseline.sql` | Canonical baseline |
| `migrations/active/` | Baseline mirror + future slot |
| `migrations/20260728000000_baseline.sql` | CLI-active baseline |

## Actions performed

1. Verified linked project `rxalcruoaqpoaiknrnau` (ACTIVE_HEALTHY)
2. Dumped live schema
3. Archived historical migrations (rename/move — not delete)
4. Published baseline for fresh installs
5. Updated structural verify scripts to read `archive/`
6. Documented upgrade path

## Not performed

- No migration content rewrites
- No schema redesign
- No production data migration
- No deletion of SQL history
