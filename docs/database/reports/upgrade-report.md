# Upgrade Report — Sprint 9.5 Phase 8

## Existing production / staging (already on historical chain)

| Step | Action |
| --- | --- |
| 1 | Deploy application code only — **no DB baseline apply** |
| 2 | Confirm `supabase_migrations.schema_migrations` already contains historical versions |
| 3 | From Sprint 10+, apply **only new** top-level migrations with timestamps > `20260728000000` |
| 4 | Never re-run `archive/*` |
| 5 | Never apply `20260728000000_baseline.sql` on an already-migrated DB |

## Why baseline is safe not to replay

Baseline is a **snapshot equivalent** of the schema produced by the archived chain on the linked project. Re-applying it on production would attempt to recreate existing types/tables and fail or conflict.

## Brand-new environment

1. Apply `20260728000000_baseline.sql`
2. Apply newer active migrations in order
3. Optional reference seeds

## Rollback

Forward-fix only. See `docs/database/migrations.md`.
