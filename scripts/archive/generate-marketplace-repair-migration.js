const fs = require("fs");
const path = require("path");

const dir = path.join("supabase", "migrations");
const sources = [
  "20260717140000_sprint21_service_requests.sql",
  "20260717150000_sprint22_marketplace_workflow.sql",
  "20260717160000_sprint23_qa_hardening.sql",
];

/**
 * Sprint 21 opens with a 4-value enum bootstrap. We already create the full
 * Sprint 22 enum set above the replay — strip the partial bootstrap so re-runs
 * never try to recreate a narrower type.
 */
function stripPartialEnumBootstrap(sql) {
  return sql.replace(
    /-- =+\r?\n-- ENUMS\r?\n-- =+\r?\n\r?\nDO \$\$\r?\nBEGIN\r?\n  IF NOT EXISTS \(SELECT 1 FROM pg_type WHERE typname = 'service_request_status'\) THEN\r?\n    CREATE TYPE public\.service_request_status AS ENUM \(\r?\n      'pending',\r?\n      'accepted',\r?\n      'rejected',\r?\n      'cancelled'\r?\n    \);\r?\n  END IF;\r?\nEND \$\$;\r?\n\r?\n/m,
    "-- ENUM bootstrap handled at top of repair (full Sprint 21–22 value set).\n\n",
  );
}

const header = `-- =============================================================================
-- REPAIR: Marketplace schema (Sprint 21–23) — must run BEFORE Sprint 29
-- =============================================================================
-- Diagnosis (remote, PostgREST PGRST205):
--   - schema_migrations marks 20260717140000 / 150000 / 160000 as applied
--   - but marketplace tables (service_requests, quotes, conversations, …) are missing
-- Root cause: history marked applied without matching schema
--   (e.g. \`supabase migration repair --status applied\` after a failed push).
--
-- This file restores ALL Sprint 21–23 marketplace objects idempotently:
--   tables, indexes, constraints, FKs, RLS, triggers, functions, storage policies.
-- Sprint 29 keeps REFERENCES public.service_requests(id) and must run AFTER this.
-- Do NOT mark Sprint 29 as applied manually.
--
-- Transaction: Supabase CLI runs each migration file inside one transaction.
-- We intentionally omit an inner BEGIN/COMMIT so we do not nest / early-commit.
-- Any RAISE EXCEPTION in the verify step aborts and rolls back the whole repair.
-- Safe to re-run: CREATE IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE.
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE 'repair: restoring full marketplace schema (Sprint 21–23)';
END $$;

-- Full enum when absent (history said applied; type may still be missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_request_status') THEN
    CREATE TYPE public.service_request_status AS ENUM (
      'pending',
      'accepted',
      'rejected',
      'cancelled',
      'quoted',
      'quote_accepted',
      'quote_declined',
      'in_progress',
      'completed_by_business',
      'completed',
      'disputed',
      'reviewed'
    );
  END IF;
END $$;

`;

const footer = `
-- =============================================================================
-- STRICT VERIFY — abort if any required marketplace object is missing
-- =============================================================================
DO $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_name TEXT;
  v_required_tables TEXT[] := ARRAY[
    'service_requests',
    'service_request_images',
    'quotes',
    'quote_items',
    'conversations',
    'messages',
    'service_reviews',
    'service_review_images',
    'provider_request_settings',
    'marketplace_notifications'
  ];
  v_required_functions TEXT[] := ARRAY[
    'accept_service_request',
    'reject_service_request',
    'post_system_message',
    'notify_marketplace_user',
    'service_request_transition_allowed',
    'enforce_service_request_status_transition',
    'touch_conversation_last_message'
  ];
  v_required_indexes TEXT[] := ARRAY[
    'service_requests_provider_status_idx',
    'service_requests_customer_idx',
    'service_requests_one_pending_per_pair',
    'service_request_images_request_idx',
    'conversations_provider_idx',
    'conversations_customer_idx',
    'messages_conversation_idx',
    'quotes_request_idx',
    'quote_items_quote_idx'
  ];
BEGIN
  -- Tables
  FOREACH v_name IN ARRAY v_required_tables LOOP
    IF to_regclass('public.' || v_name) IS NULL THEN
      v_missing := array_append(v_missing, 'table:public.' || v_name);
    END IF;
  END LOOP;

  -- service_requests.id + primary key (Sprint 29 FK target)
  IF to_regclass('public.service_requests') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'service_requests'
        AND column_name = 'id'
    ) THEN
      v_missing := array_append(v_missing, 'column:public.service_requests.id');
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'service_requests'
        AND c.contype = 'p'
    ) THEN
      v_missing := array_append(v_missing, 'pk:public.service_requests');
    END IF;
  END IF;

  -- Critical foreign keys via confrelid (reliable; ignore constraintdef schema text)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class src ON src.oid = c.conrelid
    JOIN pg_namespace src_ns ON src_ns.oid = src.relnamespace
    JOIN pg_class ref ON ref.oid = c.confrelid
    JOIN pg_namespace ref_ns ON ref_ns.oid = ref.relnamespace
    WHERE c.contype = 'f'
      AND src_ns.nspname = 'public'
      AND src.relname = 'service_request_images'
      AND ref_ns.nspname = 'public'
      AND ref.relname = 'service_requests'
  ) THEN
    v_missing := array_append(v_missing, 'fk:service_request_images->service_requests');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class src ON src.oid = c.conrelid
    JOIN pg_namespace src_ns ON src_ns.oid = src.relnamespace
    JOIN pg_class ref ON ref.oid = c.confrelid
    JOIN pg_namespace ref_ns ON ref_ns.oid = ref.relnamespace
    WHERE c.contype = 'f'
      AND src_ns.nspname = 'public'
      AND src.relname = 'quotes'
      AND ref_ns.nspname = 'public'
      AND ref.relname = 'service_requests'
  ) THEN
    v_missing := array_append(v_missing, 'fk:quotes->service_requests');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class src ON src.oid = c.conrelid
    JOIN pg_namespace src_ns ON src_ns.oid = src.relnamespace
    JOIN pg_class ref ON ref.oid = c.confrelid
    JOIN pg_namespace ref_ns ON ref_ns.oid = ref.relnamespace
    WHERE c.contype = 'f'
      AND src_ns.nspname = 'public'
      AND src.relname = 'conversations'
      AND ref_ns.nspname = 'public'
      AND ref.relname = 'service_requests'
  ) THEN
    v_missing := array_append(v_missing, 'fk:conversations->service_requests');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class src ON src.oid = c.conrelid
    JOIN pg_namespace src_ns ON src_ns.oid = src.relnamespace
    JOIN pg_class ref ON ref.oid = c.confrelid
    JOIN pg_namespace ref_ns ON ref_ns.oid = ref.relnamespace
    WHERE c.contype = 'f'
      AND src_ns.nspname = 'public'
      AND src.relname = 'messages'
      AND ref_ns.nspname = 'public'
      AND ref.relname = 'conversations'
  ) THEN
    v_missing := array_append(v_missing, 'fk:messages->conversations');
  END IF;

  -- Indexes
  FOREACH v_name IN ARRAY v_required_indexes LOOP
    IF to_regclass('public.' || v_name) IS NULL THEN
      v_missing := array_append(v_missing, 'index:public.' || v_name);
    END IF;
  END LOOP;

  -- Functions
  FOREACH v_name IN ARRAY v_required_functions LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = v_name
    ) THEN
      v_missing := array_append(v_missing, 'function:public.' || v_name);
    END IF;
  END LOOP;

  -- RLS enabled on core tables
  FOREACH v_name IN ARRAY ARRAY[
    'service_requests',
    'service_request_images',
    'quotes',
    'conversations',
    'messages'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relname = v_name AND c.relkind = 'r')
       AND NOT EXISTS (
         SELECT 1 FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = v_name AND c.relrowsecurity
       )
    THEN
      v_missing := array_append(v_missing, 'rls:public.' || v_name);
    END IF;
  END LOOP;

  -- Key triggers
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'service_requests'
      AND t.tgname = 'service_requests_updated_at' AND NOT t.tgisinternal
  ) THEN
    v_missing := array_append(v_missing, 'trigger:service_requests_updated_at');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'service_requests'
      AND t.tgname = 'trg_service_request_status_transition' AND NOT t.tgisinternal
  ) THEN
    v_missing := array_append(v_missing, 'trigger:trg_service_request_status_transition');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'messages'
      AND t.tgname = 'messages_touch_conversation' AND NOT t.tgisinternal
  ) THEN
    v_missing := array_append(v_missing, 'trigger:messages_touch_conversation');
  END IF;

  -- Enum type
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_request_status') THEN
    v_missing := array_append(v_missing, 'type:public.service_request_status');
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'repair_failed: marketplace schema incomplete after repair. Missing: %',
      array_to_string(v_missing, ', ');
  END IF;

  RAISE NOTICE 'repair_ok: marketplace schema verified (service_requests, service_request_images, quotes, conversations, messages, …)';
END $$;
`;

const body = sources
  .map((f) => {
    let raw = fs.readFileSync(path.join(dir, f), "utf8");
    if (f.includes("sprint21")) {
      raw = stripPartialEnumBootstrap(raw);
    }
    return `-- >>> BEGIN replay of ${f}\n${raw}\n-- <<< END replay of ${f}\n`;
  })
  .join("\n");

const outPath = path.join(
  dir,
  "20260720110000_repair_marketplace_service_requests_schema.sql",
);
fs.writeFileSync(outPath, header + body + footer);
console.log("Wrote", outPath, "bytes", fs.statSync(outPath).size);
