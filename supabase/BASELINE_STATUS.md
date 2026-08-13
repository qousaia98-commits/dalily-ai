# Schema baseline status (Sprint 9.5 Phase 8)

## Status: COMPLETE

| Item | State |
| --- | --- |
| Live dump | Verified via `supabase db dump --linked` |
| Baseline | `migrations/baseline/baseline.sql` |
| Archive | `migrations/archive/` (77 files) |
| Active CLI | `migrations/20260728000000_baseline.sql` |
| Docs | `docs/database/migrations.md` |
| Reports | `docs/database/reports/*` |

## Production note

Existing environments that already applied the historical chain must **not** re-apply the baseline.

## Fresh install

```bash
npm run verify:db:fresh
# or: supabase db reset  # applies top-level baseline
```

## Seeds

Reference UUIDs (modules / cities / categories / plans) remain inside archived migrations. Extract to `supabase/seed.sql` in a future hygiene pass if needed for empty local UX.
