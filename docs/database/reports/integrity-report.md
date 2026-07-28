# Integrity Report — Sprint 9.5 Phase 8

Generated from linked remote dump + archive inventory.

## Method

1. `supabase db dump --linked` → `supabase/_dump_full.sql`
2. Object inventory via SQL text analysis
3. Historical migrations moved to `migrations/archive/` (77 files)
4. Baseline assembled = dump + idempotent storage bucket inserts

## Remote dump inventory

| Object | Count |
| --- | ---: |
| CREATE TABLE | 242 |
| CREATE TYPE | 13 |
| CREATE VIEW | 6 |
| CREATE FUNCTION | 41 |
| CREATE INDEX | 297 |
| CREATE POLICY | 349 |
| ENABLE RLS | 241 |
| CREATE EXTENSION | 5 |
| FOREIGN KEY | 263 |
| CREATE TRIGGER | present (`CREATE OR REPLACE TRIGGER`) |

Extensions: `pg_stat_statements`, `pg_trgm`, `pgcrypto`, `supabase_vault`, `uuid-ossp`.

## Migration history vs live schema

| Check | Result |
| --- | --- |
| Archive count | 77 (complete historical chain) |
| Baseline derived from live dump | Yes |
| Naive concatenation used | No |
| Production schema redesign | No |

## Conclusion

Live schema dump is the integrity source of truth for the baseline. Historical migrations remain archived for audit; they are not required for fresh installs.
