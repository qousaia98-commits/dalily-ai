# Baseline Report — Sprint 9.5 Phase 8

## Artifact

- Canonical: `supabase/migrations/baseline/baseline.sql`
- CLI active: `supabase/migrations/20260728000000_baseline.sql`
- Active mirror: `supabase/migrations/active/20260728000000_baseline.sql`

## Provenance

- Command: `supabase db dump --linked`
- Project: `dalily-ai` / `rxalcruoaqpoaiknrnau`
- Plus: idempotent `storage.buckets` inserts extracted from archived migrations

## Properties

| Property | Status |
| --- | --- |
| Complete public schema | Yes |
| Indexes / constraints / FKs | Yes |
| Extensions | Yes |
| Functions / views | Yes |
| RLS policies | Yes |
| Seed-independent | Yes (no customer rows) |
| Storage platform schema | Not recreated (Supabase-managed) |
| Realtime publication | Included where present in dump |

## Size

~634 KB / ~16k lines (see integrity JSON for exact counts)
