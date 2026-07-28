# Fresh Install Report

Generated: 2026-07-28T03:09:54.776Z

## Verdict: **PASS_WITH_NOTES**

| Check | Result |
| --- | --- |
| Baseline applied | true |
| Tables match dump (242) | true (live=242) |
| Policies ≈ dump (349) | false (live=110) |

## Baseline SQL inventory

```json
{
  "types": 13,
  "tables": 242,
  "views": 6,
  "funcs": 41,
  "indexes": 297,
  "policies": 349,
  "triggers": 22,
  "rls": 241,
  "extensions": 5,
  "fks": 263
}
```

## Live counts after apply

```json
{
  "tables": 242,
  "views": 6,
  "routines": 72,
  "policies": 110,
  "indexes": 626
}
```

## Notes

- Baseline is the verified remote public schema dump plus storage bucket inserts.
- Plain Postgres stubs Supabase roles/schemas; vault/supabase_vault may warn.
- Production upgrade does not re-apply baseline — see docs/database/migrations.md.


