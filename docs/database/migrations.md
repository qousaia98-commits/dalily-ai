# Database migrations (Sprint 9.5 Phase 8)

Canonical migration lifecycle for Dalily.

## Layout

```
supabase/
  config.toml
  migrations/
    20260728000000_baseline.sql   # CLI-active baseline (identical to baseline/)
    baseline/
      baseline.sql                # Canonical documented baseline
    active/
      20260728000000_baseline.sql # Mirror + README for future migrations
      README.md
    archive/
      20260713… → 20260727…       # 77 historical migrations (immutable)
      README.md
```

Supabase CLI applies **top-level** `supabase/migrations/*.sql` only.  
Subfolders `archive/`, `baseline/`, `active/` are documentation / preservation.

## Migration strategy

| Environment | What to apply |
| --- | --- |
| **Fresh install** | `20260728000000_baseline.sql` (active baseline) |
| **Existing production** | Already applied historical versions — **do nothing** with archive/baseline |
| **New feature work** | Add `YYYYMMDDHHmmss_description.sql` at `migrations/` top-level (and copy into `active/`) |

## Baseline philosophy

- One canonical schema snapshot from the **live linked project** (`supabase db dump --linked`).
- Includes public schema: types, tables, views, functions, indexes, constraints, RLS policies, extensions, grants.
- Seed-independent: no customer data.
- Storage **platform** schema is not recreated; reference `storage.buckets` inserts are appended idempotently.
- Source dump provenance is recorded in the baseline header.

## Archive philosophy

- All 77 historical migrations preserved under `migrations/archive/`.
- Chronological filenames unchanged.
- **Never delete. Never rewrite.**
- Kept for audit, forensics, and structural verify scripts.
- Git history retained via `rename` (move), not delete.

## Adding new migrations

1. Create `supabase/migrations/YYYYMMDDHHmmss_short_name.sql`.
2. Copy the same file into `supabase/migrations/active/`.
3. Keep changes additive and reversible where possible.
4. Update `src/types/database.types.ts` after apply (`supabase gen types`).
5. Document breaking changes in `docs/migration/`.

Timestamp must be **after** `20260728000000`.

## Developer onboarding

```bash
# Linked remote (preferred for dump/types)
npx supabase link

# Fresh local (Docker required)
npx supabase start
npx supabase db reset   # applies top-level migrations (baseline + newer)
```

Historical chain is **not** replayed on fresh local resets.

## Fresh installation

1. Empty Supabase project / local stack.
2. Apply only active baseline (`20260728000000_baseline.sql`).
3. Optionally load reference seeds (cities/categories/plans) from archive excerpts or a future `seed.sql`.
4. Validate: `npm run verify:db:fresh` (Docker Postgres apply + inventory check).

## Production upgrades

**Existing production that already ran the historical 77 migrations:**

1. Do **not** run baseline against production.
2. Do **not** replay `archive/`.
3. Mark baseline as already satisfied operationally (schema already matches dump).
4. From Sprint 10 onward, ship only **new** top-level migrations after `20260728000000`.

If a brand-new production project is created:

1. Apply baseline once.
2. Apply subsequent active migrations in order.

## Rollback policy

- Prefer forward-fix migrations.
- Do not edit applied migration files.
- Destructive rollbacks require an explicit new migration + ops approval.
- Archive remains the legal history of how production was built.

## Reports

See `docs/database/reports/`:

- Integrity, Migration, Baseline, Archive, Fresh Install, Upgrade

## Related

- `supabase/BASELINE_STATUS.md` — status board
- `docs/architecture/modularization.md` — app modularization (Phase 7)
- `docs/architecture/infrastructure.md` — infra layer (Phase 6)
