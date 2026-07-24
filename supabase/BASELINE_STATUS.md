# Schema baseline status (Sprint 48 cleanup)

## Decision (safety-first)

Active migrations in `supabase/migrations/` were **not** replaced with a single baseline.

Reason: `supabase db dump --linked` failed in this environment (Docker Desktop / ECR image pull returned HTTP 500). Without a verified dump that is **identical** to the live schema, replacing migrations would risk losing SQL, policies, functions, or triggers.

## What to do next (when dump works)

1. Ensure Docker Desktop is healthy.
2. Run:

```bash
supabase db dump --linked -f supabase/migrations/20260724160000_baseline.sql
```

3. Verify the dump against the remote (tables, views, functions, triggers, indexes, RLS policies, storage, extensions).
4. Only after verification: move the historical `*.sql` files from `supabase/migrations/` into `supabase/migrations_archive/` (do not delete them).
5. Keep the baseline as the only active migration file for fresh environments.

## Seeds

- Reference UUIDs (modules / cities / categories / plans) live inside historical migrations — keep until extracted into `supabase/seed.sql`.
- Demo providers: `npm run seed:search` (`scripts/seed-search-providers.mjs`) — retain for development.

## Intentionally kept

- All 25 historical migration files in `supabase/migrations/`
- Root `schema.sql` (stale snapshot; not used as source of truth)
- Empty `supabase/seed/` placeholder
