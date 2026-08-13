-- =============================================================================
-- Dalily schema baseline (Sprint 9.5 Phase 8)
-- =============================================================================
-- Source: supabase db dump --linked (project rxalcruoaqpoaiknrnau)
-- Generated: 2026-07-28T03:02:49.731Z
-- Historical chain archived: supabase/migrations/archive/ (77 files)
--
-- Purpose:
--   Fresh installs apply THIS file (via active CLI path) instead of replaying
--   the full historical migration chain.
--
-- Existing production:
--   Already applied historical migrations. Do NOT replay archive or baseline
--   against production. See docs/database/migrations.md.
--
-- Seed policy:
--   Schema is seed-independent. Reference buckets are appended idempotently
--   below. Cities/categories/plans seeds live in archive migrations / seed.sql.
-- =============================================================================




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'user',
    'business',
    'admin',
    'moderator'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."audit_action" AS ENUM (
    'provider_approved',
    'provider_rejected',
    'provider_activated',
    'provider_suspended',
    'provider_archived',
    'provider_deleted',
    'user_role_changed',
    'user_disabled',
    'user_activated',
    'payment_approved',
    'payment_rejected',
    'subscription_extended',
    'subscription_cancelled',
    'subscription_plan_changed',
    'category_created',
    'category_updated',
    'category_disabled',
    'category_enabled',
    'provider_changes_requested',
    'refund_approved',
    'refund_rejected',
    'dispute_evidence_uploaded'
);


ALTER TYPE "public"."audit_action" OWNER TO "postgres";


CREATE TYPE "public"."invoice_status" AS ENUM (
    'draft',
    'issued',
    'paid',
    'void'
);


ALTER TYPE "public"."invoice_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_provider" AS ENUM (
    'manual',
    'shamcash',
    'future',
    'stripe'
);


ALTER TYPE "public"."payment_provider" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'paid',
    'failed',
    'cancelled',
    'pending_review',
    'rejected',
    'expired'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."problem_priority" AS ENUM (
    'emergency',
    'high',
    'normal',
    'low'
);


ALTER TYPE "public"."problem_priority" OWNER TO "postgres";


CREATE TYPE "public"."provider_status" AS ENUM (
    'draft',
    'pending_review',
    'active',
    'suspended',
    'archived',
    'changes_requested'
);


ALTER TYPE "public"."provider_status" OWNER TO "postgres";


CREATE TYPE "public"."provider_verification_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."provider_verification_status" OWNER TO "postgres";


CREATE TYPE "public"."review_status" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'hidden'
);


ALTER TYPE "public"."review_status" OWNER TO "postgres";


CREATE TYPE "public"."service_request_status" AS ENUM (
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


ALTER TYPE "public"."service_request_status" OWNER TO "postgres";


CREATE TYPE "public"."subscription_status" AS ENUM (
    'trial',
    'active',
    'pending_payment',
    'expired',
    'cancelled'
);


ALTER TYPE "public"."subscription_status" OWNER TO "postgres";


CREATE TYPE "public"."user_status" AS ENUM (
    'active',
    'suspended',
    'banned'
);


ALTER TYPE "public"."user_status" OWNER TO "postgres";


CREATE TYPE "public"."verification_status" AS ENUM (
    'unverified',
    'pending',
    'partially_verified',
    'verified',
    'rejected',
    'expired'
);


ALTER TYPE "public"."verification_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_service_request"("p_request_id" "uuid", "p_actor_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_request public.service_requests%ROWTYPE;
  v_conversation_id UUID;
  v_summary TEXT;
BEGIN
  SELECT * INTO v_request
  FROM public.service_requests sr
  WHERE sr.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.id = v_request.provider_id
      AND p.owner_id = p_actor_id
      AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.service_requests
  SET
    status = 'accepted',
    accepted_at = now(),
    response_time_seconds = GREATEST(0, EXTRACT(EPOCH FROM (now() - created_at))::INTEGER)
  WHERE id = p_request_id;

  INSERT INTO public.conversations (provider_id, customer_id, service_request_id)
  VALUES (v_request.provider_id, v_request.customer_id, p_request_id)
  RETURNING id INTO v_conversation_id;

  v_summary := trim(v_request.title) || E'\n\n' || trim(v_request.description);

  INSERT INTO public.messages (conversation_id, sender_id, body_text, is_system, event_type)
  VALUES (v_conversation_id, p_actor_id, 'Request accepted. You can now chat about this service.', true, 'request_accepted');

  INSERT INTO public.messages (conversation_id, sender_id, body_text, is_system, event_type)
  VALUES (v_conversation_id, p_actor_id, v_summary, true, 'request_summary');

  PERFORM public.notify_marketplace_user(
    v_request.customer_id,
    'request_accepted',
    'notifications.requestAccepted.title',
    'notifications.requestAccepted.body',
    jsonb_build_object('title', v_request.title),
    '/messages/' || v_conversation_id::text,
    p_request_id,
    v_conversation_id
  );

  RETURN v_conversation_id;
END;
$$;


ALTER FUNCTION "public"."accept_service_request"("p_request_id" "uuid", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bookings_no_overlap"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('pending', 'confirmed', 'rescheduled') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.provider_id = NEW.provider_id
      AND b.deleted_at IS NULL
      AND b.id IS DISTINCT FROM NEW.id
      AND b.status IN ('pending', 'confirmed', 'rescheduled')
      AND tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'booking_overlap';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."bookings_no_overlap"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clear_conversation_typing"("p_conversation_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM public.conversation_typing
  WHERE conversation_id = p_conversation_id AND user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."clear_conversation_typing"("p_conversation_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."conversation_allows_message_insert"("p_conversation_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    LEFT JOIN public.service_requests sr ON sr.id = c.service_request_id
    WHERE c.id = p_conversation_id
      AND c.deleted_at IS NULL
      AND (
        c.service_request_id IS NULL
        OR public.has_chat_release_grant(c.service_request_id)
        OR (
          -- Dual-run: pre-marketplace-native RFQ chats keep status gate
          COALESCE(sr.lifecycle_version, 1) < 2
          AND sr.status IN (
            'accepted', 'quoted', 'quote_accepted', 'quote_declined',
            'in_progress', 'completed_by_business', 'completed'
          )
        )
      )
  );
$$;


ALTER FUNCTION "public"."conversation_allows_message_insert"("p_conversation_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."conversation_allows_message_insert"("p_conversation_id" "uuid") IS 'RLS helper: grant for v2 / unlocked, or legacy status for lifecycle_version < 2.';



CREATE OR REPLACE FUNCTION "public"."enforce_service_request_status_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NOT public.service_request_transition_allowed(OLD.status, NEW.status)
  THEN
    RAISE EXCEPTION 'invalid_status_transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_service_request_status_transition"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_chat_release_grant"("p_service_request_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contact_release_grants g
    WHERE g.service_request_id = p_service_request_id
      AND (
        g.scope ? 'chat'
        OR g.scope @> '"chat"'::jsonb
        OR g.scope @> '["chat"]'::jsonb
      )
  );
$$;


ALTER FUNCTION "public"."has_chat_release_grant"("p_service_request_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."has_chat_release_grant"("p_service_request_id" "uuid") IS 'True when a contact_release_grants row authorizes full chat for the request.';



CREATE OR REPLACE FUNCTION "public"."has_role"("check_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = check_role
      AND revoked_at IS NULL
  );
$$;


ALTER FUNCTION "public"."has_role"("check_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_booking_participant"("p_booking_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    LEFT JOIN public.providers pr ON pr.id = b.provider_id
    WHERE b.id = p_booking_id
      AND b.deleted_at IS NULL
      AND (b.customer_id = p_user_id OR pr.owner_id = p_user_id)
  );
$$;


ALTER FUNCTION "public"."is_booking_participant"("p_booking_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_conversation_participant"("p_conversation_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    LEFT JOIN public.providers pr ON pr.id = c.provider_id
    WHERE c.id = p_conversation_id
      AND c.deleted_at IS NULL
      AND (
        c.customer_id = p_user_id
        OR pr.owner_id = p_user_id
        OR c.admin_user_id = p_user_id
        OR EXISTS (
          SELECT 1 FROM public.conversation_participants cp
          WHERE cp.conversation_id = c.id
            AND cp.user_id = p_user_id
            AND cp.deleted_at IS NULL
        )
      )
  );
$$;


ALTER FUNCTION "public"."is_conversation_participant"("p_conversation_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_project_member"("p_project_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.service_projects sp
    WHERE sp.id = p_project_id AND sp.customer_id = p_user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.project_packages pp
    JOIN public.providers pr ON pr.id = pp.assigned_provider_id
    WHERE pp.project_id = p_project_id AND pr.owner_id = p_user_id
  )
  OR public.has_role('admin');
$$;


ALTER FUNCTION "public"."is_project_member"("p_project_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_provider_owner"("p_provider_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.providers
    WHERE id = p_provider_id AND owner_id = p_user_id
  );
$$;


ALTER FUNCTION "public"."is_provider_owner"("p_provider_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_booking_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.booking_status_log (booking_id, from_status, to_status, actor_id)
    VALUES (NEW.id, NULL, NEW.status, NEW.customer_id);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.booking_status_log (booking_id, from_status, to_status)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_booking_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_all_conversations_read"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  updated_count INT := 0;
BEGIN
  UPDATE public.conversation_participants
  SET last_read_at = now(), last_delivered_at = now()
  WHERE user_id = p_user_id
    AND (last_read_at IS NULL OR last_read_at < now());

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;


ALTER FUNCTION "public"."mark_all_conversations_read"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_conversation_read"("p_conversation_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_conversation_participant(p_conversation_id, p_user_id) THEN
    RETURN;
  END IF;

  PERFORM public.mark_messages_delivered(p_conversation_id, p_user_id);

  UPDATE public.messages m
  SET delivery_status = 'read'
  WHERE m.conversation_id = p_conversation_id
    AND m.sender_id <> p_user_id
    AND m.deleted_at IS NULL
    AND m.delivery_status <> 'read';

  INSERT INTO public.message_read_receipts (message_id, user_id, status, delivered_at, read_at)
  SELECT m.id, p_user_id, 'read', coalesce(r.delivered_at, now()), now()
  FROM public.messages m
  LEFT JOIN public.message_read_receipts r
    ON r.message_id = m.id AND r.user_id = p_user_id
  WHERE m.conversation_id = p_conversation_id
    AND m.sender_id <> p_user_id
    AND m.deleted_at IS NULL
  ON CONFLICT (message_id, user_id) DO UPDATE
    SET status = 'read',
        read_at = now(),
        delivered_at = coalesce(message_read_receipts.delivered_at, excluded.delivered_at);

  UPDATE public.conversation_participants
  SET last_read_at = now(), last_delivered_at = coalesce(last_delivered_at, now())
  WHERE conversation_id = p_conversation_id AND user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."mark_conversation_read"("p_conversation_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_messages_delivered"("p_conversation_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_conversation_participant(p_conversation_id, p_user_id) THEN
    RETURN;
  END IF;

  UPDATE public.messages m
  SET delivery_status = CASE
    WHEN m.delivery_status = 'sent' THEN 'delivered'
    ELSE m.delivery_status
  END
  WHERE m.conversation_id = p_conversation_id
    AND m.sender_id <> p_user_id
    AND m.deleted_at IS NULL
    AND m.delivery_status = 'sent';

  INSERT INTO public.message_read_receipts (message_id, user_id, status, delivered_at)
  SELECT m.id, p_user_id, 'delivered', now()
  FROM public.messages m
  WHERE m.conversation_id = p_conversation_id
    AND m.sender_id <> p_user_id
    AND m.deleted_at IS NULL
  ON CONFLICT (message_id, user_id) DO UPDATE
    SET delivered_at = coalesce(message_read_receipts.delivered_at, excluded.delivered_at),
        status = CASE
          WHEN message_read_receipts.status = 'read' THEN 'read'
          ELSE 'delivered'
        END;

  UPDATE public.conversation_participants
  SET last_delivered_at = now()
  WHERE conversation_id = p_conversation_id AND user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."mark_messages_delivered"("p_conversation_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_document_number"("p_prefix" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  y INTEGER := EXTRACT(YEAR FROM now() AT TIME ZONE 'UTC')::INTEGER;
  next_val INTEGER;
BEGIN
  IF p_prefix NOT IN ('INV', 'RCP', 'CRN') THEN
    RAISE EXCEPTION 'invalid_document_prefix';
  END IF;

  INSERT INTO public.document_number_sequences (prefix, year, last_value)
  VALUES (p_prefix, y, 1)
  ON CONFLICT (prefix, year)
  DO UPDATE SET last_value = public.document_number_sequences.last_value + 1
  RETURNING last_value INTO next_val;

  RETURN p_prefix || '-' || y::TEXT || '-' || lpad(next_val::TEXT, 6, '0');
END;
$$;


ALTER FUNCTION "public"."next_document_number"("p_prefix" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."next_document_number"("p_prefix" "text") IS 'Atomic sequential INV/RCP/CRN document numbers per year.';



CREATE OR REPLACE FUNCTION "public"."next_investigation_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  n BIGINT;
BEGIN
  n := nextval('public.investigation_number_seq');
  RETURN 'INV-' || to_char(now(), 'YYYYMM') || '-' || lpad(n::TEXT, 5, '0');
END;
$$;


ALTER FUNCTION "public"."next_investigation_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_quality_case_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  n BIGINT;
BEGIN
  n := nextval('public.quality_case_number_seq');
  RETURN 'QC-' || to_char(now(), 'YYYYMM') || '-' || lpad(n::TEXT, 5, '0');
END;
$$;


ALTER FUNCTION "public"."next_quality_case_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_marketplace_user"("p_user_id" "uuid", "p_type" character varying, "p_title_key" character varying, "p_body_key" character varying, "p_body_params" "jsonb" DEFAULT '{}'::"jsonb", "p_href" "text" DEFAULT NULL::"text", "p_request_id" "uuid" DEFAULT NULL::"uuid", "p_conversation_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_id UUID;
  v_ok BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Caller may notify the other party on a shared request/conversation,
  -- or notify themselves (edge), or be admin/moderator.
  IF public.has_role('admin') OR public.has_role('moderator') THEN
    v_ok := TRUE;
  ELSIF p_request_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.service_requests sr
      LEFT JOIN public.providers p ON p.id = sr.provider_id
      WHERE sr.id = p_request_id
        AND (
          sr.customer_id = auth.uid()
          OR p.owner_id = auth.uid()
        )
        AND p_user_id IN (sr.customer_id, p.owner_id)
    ) INTO v_ok;
  ELSIF p_conversation_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.conversations c
      LEFT JOIN public.providers p ON p.id = c.provider_id
      WHERE c.id = p_conversation_id
        AND (
          c.customer_id = auth.uid()
          OR p.owner_id = auth.uid()
        )
        AND p_user_id IN (c.customer_id, p.owner_id)
    ) INTO v_ok;
  END IF;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.marketplace_notifications (
    user_id, type, title_key, body_key, body_params, href, service_request_id, conversation_id
  ) VALUES (
    p_user_id, p_type, p_title_key, p_body_key, COALESCE(p_body_params, '{}'),
    p_href, p_request_id, p_conversation_id
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."notify_marketplace_user"("p_user_id" "uuid", "p_type" character varying, "p_title_key" character varying, "p_body_key" character varying, "p_body_params" "jsonb", "p_href" "text", "p_request_id" "uuid", "p_conversation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_system_message"("p_conversation_id" "uuid", "p_actor_id" "uuid", "p_body" "text", "p_event_type" character varying) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND (
        c.customer_id = p_actor_id
        OR EXISTS (
          SELECT 1 FROM public.providers p
          WHERE p.id = c.provider_id AND p.owner_id = p_actor_id AND p.deleted_at IS NULL
        )
      )
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, body_text, is_system, event_type)
  VALUES (p_conversation_id, p_actor_id, p_body, true, p_event_type)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."post_system_message"("p_conversation_id" "uuid", "p_actor_id" "uuid", "p_body" "text", "p_event_type" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_privileged_user_self_updates"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF auth.uid() = OLD.id
     AND NOT (public.has_role('admin') OR public.has_role('moderator')) THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'users.status cannot be changed by account owner';
    END IF;
    IF NEW.email_verified_at IS DISTINCT FROM OLD.email_verified_at THEN
      RAISE EXCEPTION 'users.email_verified_at cannot be changed by account owner';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_privileged_user_self_updates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_provider_privileged_self_updates"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF auth.uid() = OLD.owner_id
     AND NOT (public.has_role('admin') OR public.has_role('moderator')) THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'active' THEN
      RAISE EXCEPTION 'providers.status cannot be set to active by owner';
    END IF;
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
       AND NEW.verification_status IN ('verified', 'partially_verified') THEN
      RAISE EXCEPTION 'providers.verification_status cannot be escalated by owner';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_provider_privileged_self_updates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."promote_bookings_awaiting_confirmation"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  updated_count INT := 0;
BEGIN
  WITH due AS (
    UPDATE public.bookings b
    SET
      status = 'awaiting_customer_confirmation',
      completion_prompted_at = COALESCE(b.completion_prompted_at, now()),
      updated_at = now()
    WHERE b.deleted_at IS NULL
      AND b.status = 'confirmed'
      AND b.ends_at <= now()
    RETURNING b.id
  )
  SELECT COUNT(*)::INT INTO updated_count FROM due;

  RETURN updated_count;
END;
$$;


ALTER FUNCTION "public"."promote_bookings_awaiting_confirmation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."provider_has_marketplace_access_to_request"("p_request_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contact_release_grants g
    JOIN public.providers p ON p.id = g.provider_id
    WHERE g.service_request_id = p_request_id
      AND p.owner_id = auth.uid()
      AND p.deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1
    FROM public.marketplace_selections ms
    JOIN public.providers p ON p.id = ms.provider_id
    WHERE ms.service_request_id = p_request_id
      AND ms.status IN ('unlocked', 'pending_unlock')
      AND p.owner_id = auth.uid()
      AND p.deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1
    FROM public.unlock_sessions us
    JOIN public.providers p ON p.id = us.provider_id
    WHERE us.service_request_id = p_request_id
      AND us.status IN ('succeeded', 'opened', 'payment_pending')
      AND p.owner_id = auth.uid()
      AND p.deleted_at IS NULL
  );
$$;


ALTER FUNCTION "public"."provider_has_marketplace_access_to_request"("p_request_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."provider_has_marketplace_access_to_request"("p_request_id" "uuid") IS 'Marketplace v2: auth.uid() may access request via grant/selection/unlock session (no provider_id).';



CREATE OR REPLACE FUNCTION "public"."provider_owns_match_assignment_for_request"("p_request_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.match_assignments ma
    JOIN public.providers p ON p.id = ma.provider_id
    WHERE ma.service_request_id = p_request_id
      AND p.owner_id = auth.uid()
      AND p.deleted_at IS NULL
  );
$$;


ALTER FUNCTION "public"."provider_owns_match_assignment_for_request"("p_request_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."provider_owns_match_assignment_for_request"("p_request_id" "uuid") IS 'Sprint 4: non-recursive check that auth.uid() owns a match_assignment for the request.';



CREATE OR REPLACE FUNCTION "public"."recompute_provider_trust_score"("p_provider_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_avg NUMERIC;
  v_count INTEGER;
  v_verified INTEGER;
  v_helpful INTEGER;
  v_completed INTEGER;
  v_verification TEXT;
  v_recommend_yes INTEGER;
  v_recommend_total INTEGER;
  v_with_reply INTEGER;
  v_recent_avg NUMERIC;
  v_score NUMERIC := 0;
  v_final INTEGER;
BEGIN
  SELECT
    COALESCE(AVG(rating), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE is_verified),
    COALESCE(SUM(helpful_count), 0),
    COUNT(*) FILTER (WHERE recommend IS TRUE),
    COUNT(*) FILTER (WHERE recommend IS NOT NULL),
    COUNT(*) FILTER (WHERE provider_reply IS NOT NULL),
    COALESCE(
      AVG(rating) FILTER (WHERE created_at > now() - INTERVAL '180 days'),
      AVG(rating),
      0
    )
  INTO v_avg, v_count, v_verified, v_helpful, v_recommend_yes, v_recommend_total, v_with_reply, v_recent_avg
  FROM public.service_reviews
  WHERE provider_id = p_provider_id
    AND deleted_at IS NULL
    AND status = 'approved';

  SELECT verification_status INTO v_verification
  FROM public.providers WHERE id = p_provider_id;

  SELECT COUNT(*) INTO v_completed
  FROM public.service_requests
  WHERE provider_id = p_provider_id
    AND status IN ('completed', 'reviewed');

  v_score := v_score + LEAST(40, (((v_avg * 0.4) + (v_recent_avg * 0.6)) / 5.0) * 40);
  v_score := v_score + LEAST(18, LN(1 + v_count) * 6.0);
  IF v_count > 0 THEN
    v_score := v_score + (v_verified::NUMERIC / v_count) * 12;
    IF v_recommend_total > 0 THEN
      v_score := v_score + (v_recommend_yes::NUMERIC / v_recommend_total) * 8;
    END IF;
    v_score := v_score + LEAST(6, (v_with_reply::NUMERIC / v_count) * 6);
  END IF;
  v_score := v_score + LEAST(8, LN(1 + v_helpful) * 3.0);

  IF v_verification = 'verified' THEN v_score := v_score + 10;
  ELSIF v_verification = 'partially_verified' THEN v_score := v_score + 5;
  END IF;

  v_score := v_score + LEAST(5, LN(1 + v_completed) * 1.6);
  v_final := GREATEST(0, LEAST(100, ROUND(v_score)::INTEGER));

  UPDATE public.providers
  SET
    trust_score = v_final,
    rating_avg = ROUND(COALESCE(v_avg, 0)::NUMERIC, 2),
    review_count = COALESCE(v_count, 0),
    updated_at = now()
  WHERE id = p_provider_id;

  INSERT INTO public.provider_reputation_cache (
    provider_id, recommendation_rate, response_rate, quality_label, computed_at, payload
  ) VALUES (
    p_provider_id,
    CASE WHEN v_recommend_total > 0
      THEN ROUND((v_recommend_yes::NUMERIC / v_recommend_total) * 100, 2)
      ELSE NULL END,
    CASE WHEN v_count > 0
      THEN ROUND((v_with_reply::NUMERIC / v_count) * 100, 2)
      ELSE NULL END,
    CASE
      WHEN COALESCE(v_avg, 0) >= 4.7 THEN 'Excellent'
      WHEN COALESCE(v_avg, 0) >= 4.2 THEN 'Very good'
      WHEN COALESCE(v_avg, 0) >= 3.5 THEN 'Good'
      WHEN COALESCE(v_avg, 0) >= 2.5 THEN 'Fair'
      WHEN v_count = 0 THEN NULL
      ELSE 'Needs improvement'
    END,
    now(),
    jsonb_build_object(
      'ratingAvg', COALESCE(v_avg, 0),
      'recentAvg', COALESCE(v_recent_avg, 0),
      'reviewCount', COALESCE(v_count, 0)
    )
  )
  ON CONFLICT (provider_id) DO UPDATE SET
    recommendation_rate = EXCLUDED.recommendation_rate,
    response_rate = EXCLUDED.response_rate,
    quality_label = EXCLUDED.quality_label,
    computed_at = EXCLUDED.computed_at,
    payload = EXCLUDED.payload;

  RETURN v_final;
END;
$$;


ALTER FUNCTION "public"."recompute_provider_trust_score"("p_provider_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_user_storage_usage"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.user_storage_usage (user_id, bytes_used, file_count, deleted_bytes, deleted_file_count, updated_at)
  SELECT
    p_user_id,
    COALESCE(SUM(size_bytes) FILTER (WHERE deleted_at IS NULL), 0),
    COALESCE(COUNT(*) FILTER (WHERE deleted_at IS NULL), 0)::INT,
    COALESCE(SUM(size_bytes) FILTER (WHERE deleted_at IS NOT NULL), 0),
    COALESCE(COUNT(*) FILTER (WHERE deleted_at IS NOT NULL), 0)::INT,
    now()
  FROM public.media_objects
  WHERE owner_user_id = p_user_id
  ON CONFLICT (user_id) DO UPDATE
    SET bytes_used = EXCLUDED.bytes_used,
        file_count = EXCLUDED.file_count,
        deleted_bytes = EXCLUDED.deleted_bytes,
        deleted_file_count = EXCLUDED.deleted_file_count,
        updated_at = now();
END;
$$;


ALTER FUNCTION "public"."recompute_user_storage_usage"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_service_request"("p_request_id" "uuid", "p_actor_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_request public.service_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_request
  FROM public.service_requests sr
  WHERE sr.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.id = v_request.provider_id
      AND p.owner_id = p_actor_id
      AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.service_requests
  SET
    status = 'rejected',
    rejected_at = now(),
    response_time_seconds = GREATEST(0, EXTRACT(EPOCH FROM (now() - created_at))::INTEGER)
  WHERE id = p_request_id;

  PERFORM public.notify_marketplace_user(
    v_request.customer_id,
    'request_rejected',
    'notifications.requestRejected.title',
    'notifications.requestRejected.body',
    jsonb_build_object('title', v_request.title),
    '/account/requests',
    p_request_id,
    NULL
  );
END;
$$;


ALTER FUNCTION "public"."reject_service_request"("p_request_id" "uuid", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_media_object"("p_media_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.media_objects
  SET deleted_at = NULL,
      restore_until = NULL,
      updated_at = now()
  WHERE id = p_media_id
    AND owner_user_id = p_user_id
    AND deleted_at IS NOT NULL
    AND (restore_until IS NULL OR restore_until > now());

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.message_attachments
  SET deleted_at = NULL, restore_until = NULL
  WHERE media_object_id = p_media_id;

  UPDATE public.project_documents
  SET deleted_at = NULL, restore_until = NULL
  WHERE media_object_id = p_media_id;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."restore_media_object"("p_media_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_chat_messages"("p_user_id" "uuid", "p_query" "text", "p_conversation_id" "uuid" DEFAULT NULL::"uuid", "p_sender_id" "uuid" DEFAULT NULL::"uuid", "p_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_to" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_limit" integer DEFAULT 40) RETURNS TABLE("id" "uuid", "conversation_id" "uuid", "sender_id" "uuid", "body_text" "text", "created_at" timestamp with time zone, "message_type" "text", "delivery_status" "text", "edited_at" timestamp with time zone, "reply_to_message_id" "uuid", "is_pinned" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.conversation_id,
    m.sender_id,
    m.body_text,
    m.created_at,
    m.message_type::text,
    COALESCE(m.delivery_status::text, 'sent'),
    m.edited_at,
    m.reply_to_message_id,
    COALESCE(m.is_pinned, false)
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  LEFT JOIN public.providers pr ON pr.id = c.provider_id
  WHERE m.deleted_at IS NULL
    AND c.deleted_at IS NULL
    AND (
      c.customer_id = p_user_id
      OR pr.owner_id = p_user_id
      OR c.admin_user_id = p_user_id
      OR EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = c.id AND cp.user_id = p_user_id
      )
    )
    AND (p_conversation_id IS NULL OR m.conversation_id = p_conversation_id)
    AND (p_sender_id IS NULL OR m.sender_id = p_sender_id)
    AND (p_from IS NULL OR m.created_at >= p_from)
    AND (p_to IS NULL OR m.created_at <= p_to)
    AND m.body_text ILIKE ('%' || p_query || '%')
  ORDER BY m.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
END;
$$;


ALTER FUNCTION "public"."search_chat_messages"("p_user_id" "uuid", "p_query" "text", "p_conversation_id" "uuid", "p_sender_id" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_chat_voice_transcripts"("p_user_id" "uuid", "p_query" "text", "p_conversation_id" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 30) RETURNS TABLE("id" "uuid", "conversation_id" "uuid", "message_id" "uuid", "transcript_text" "text", "summary_text" "text", "language" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.conversation_id,
    t.message_id,
    t.transcript_text,
    t.summary_text,
    t.language,
    t.created_at
  FROM public.chat_voice_transcripts t
  JOIN public.conversations c ON c.id = t.conversation_id
  LEFT JOIN public.providers pr ON pr.id = c.provider_id
  WHERE t.deleted_at IS NULL
    AND c.deleted_at IS NULL
    AND (
      c.customer_id = p_user_id
      OR pr.owner_id = p_user_id
      OR c.admin_user_id = p_user_id
      OR EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = c.id AND cp.user_id = p_user_id AND cp.deleted_at IS NULL
      )
    )
    AND (p_conversation_id IS NULL OR t.conversation_id = p_conversation_id)
    AND t.transcript_text ILIKE ('%' || p_query || '%')
  ORDER BY t.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 50));
END;
$$;


ALTER FUNCTION "public"."search_chat_voice_transcripts"("p_user_id" "uuid", "p_query" "text", "p_conversation_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."service_request_transition_allowed"("p_old" "public"."service_request_status", "p_new" "public"."service_request_status") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT CASE
    WHEN p_old IS NOT DISTINCT FROM p_new THEN TRUE
    WHEN p_old = 'pending' AND p_new IN ('accepted', 'rejected', 'cancelled') THEN TRUE
    WHEN p_old = 'accepted' AND p_new IN ('quoted', 'in_progress', 'completed_by_business', 'cancelled') THEN TRUE
    WHEN p_old = 'quoted' AND p_new IN ('quote_accepted', 'quote_declined', 'accepted', 'cancelled') THEN TRUE
    WHEN p_old = 'quote_accepted' AND p_new IN ('in_progress', 'completed_by_business', 'cancelled') THEN TRUE
    WHEN p_old = 'quote_declined' AND p_new IN ('quoted', 'accepted', 'in_progress', 'completed_by_business', 'cancelled') THEN TRUE
    WHEN p_old = 'in_progress' AND p_new IN ('completed_by_business', 'disputed', 'cancelled') THEN TRUE
    WHEN p_old = 'completed_by_business' AND p_new IN ('completed', 'disputed') THEN TRUE
    WHEN p_old = 'completed' AND p_new IN ('reviewed', 'disputed') THEN TRUE
    WHEN p_old = 'disputed' AND p_new IN ('in_progress', 'completed_by_business', 'completed', 'cancelled') THEN TRUE
    ELSE FALSE
  END;
$$;


ALTER FUNCTION "public"."service_request_transition_allowed"("p_old" "public"."service_request_status", "p_new" "public"."service_request_status") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_media_object"("p_media_id" "uuid", "p_user_id" "uuid", "p_restore_days" integer DEFAULT 7) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.media_objects
  SET deleted_at = now(),
      restore_until = now() + make_interval(days => GREATEST(1, LEAST(p_restore_days, 30))),
      updated_at = now()
  WHERE id = p_media_id
    AND owner_user_id = p_user_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.message_attachments
  SET deleted_at = now(),
      restore_until = now() + make_interval(days => GREATEST(1, LEAST(p_restore_days, 30)))
  WHERE media_object_id = p_media_id AND deleted_at IS NULL;

  UPDATE public.project_documents
  SET deleted_at = now(),
      restore_until = now() + make_interval(days => GREATEST(1, LEAST(p_restore_days, 30)))
  WHERE media_object_id = p_media_id AND deleted_at IS NULL;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."soft_delete_media_object"("p_media_id" "uuid", "p_user_id" "uuid", "p_restore_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_conversation_participants"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_owner UUID;
BEGIN
  INSERT INTO public.conversation_participants (conversation_id, user_id, role)
  VALUES (NEW.id, NEW.customer_id, 'customer')
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  SELECT owner_id INTO v_owner FROM public.providers WHERE id = NEW.provider_id;
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.conversation_participants (conversation_id, user_id, role)
    VALUES (NEW.id, v_owner, 'provider')
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;

  IF NEW.admin_user_id IS NOT NULL THEN
    INSERT INTO public.conversation_participants (conversation_id, user_id, role)
    VALUES (NEW.id, NEW.admin_user_id, 'admin')
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_conversation_participants"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_review_helpful_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.service_reviews
    SET helpful_count = helpful_count + 1, updated_at = now()
    WHERE id = NEW.review_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.service_reviews
    SET helpful_count = GREATEST(0, helpful_count - 1), updated_at = now()
    WHERE id = OLD.review_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."sync_review_helpful_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_booking_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_booking_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_conversation_last_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_conversation_last_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_conversation_typing"("p_conversation_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_conversation_participant(p_conversation_id, p_user_id) THEN
    RETURN;
  END IF;
  INSERT INTO public.conversation_typing (conversation_id, user_id, started_at, expires_at)
  VALUES (p_conversation_id, p_user_id, now(), now() + interval '6 seconds')
  ON CONFLICT (conversation_id, user_id) DO UPDATE
    SET started_at = now(),
        expires_at = now() + interval '6 seconds';
END;
$$;


ALTER FUNCTION "public"."touch_conversation_typing"("p_conversation_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_media_objects_storage"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_user_storage_usage(OLD.owner_user_id);
    RETURN OLD;
  END IF;
  PERFORM public.recompute_user_storage_usage(NEW.owner_user_id);
  IF TG_OP = 'UPDATE' AND OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id THEN
    PERFORM public.recompute_user_storage_usage(OLD.owner_user_id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_media_objects_storage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_user_presence"("p_user_id" "uuid", "p_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.user_presence (user_id, status, last_seen_at, updated_at)
  VALUES (p_user_id, p_status, now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET status = excluded.status,
        last_seen_at = CASE
          WHEN excluded.status = 'offline' THEN now()
          ELSE user_presence.last_seen_at
        END,
        updated_at = now();
END;
$$;


ALTER FUNCTION "public"."upsert_user_presence"("p_user_id" "uuid", "p_status" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_action_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_action_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_broadcasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "title_key" "text",
    "body_key" "text",
    "target" "text" DEFAULT 'all'::"text" NOT NULL,
    "target_user_id" "uuid",
    "href" "text",
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "scheduled_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "delivery_count" integer DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "admin_broadcasts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'scheduled'::"text", 'sent'::"text", 'failed'::"text"]))),
    CONSTRAINT "admin_broadcasts_target_check" CHECK (("target" = ANY (ARRAY['all'::"text", 'providers'::"text", 'customers'::"text", 'single'::"text"])))
);


ALTER TABLE "public"."admin_broadcasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_assistant_contexts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_request_id" "uuid",
    "booking_id" "uuid",
    "conversation_id" "uuid",
    "audience" "text" NOT NULL,
    "phase" "text" DEFAULT 'intake'::"text" NOT NULL,
    "confirmed_facts" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "asked_questions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "last_summary" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_assistant_contexts_audience_check" CHECK (("audience" = ANY (ARRAY['customer'::"text", 'provider'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."ai_assistant_contexts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_automation_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workflow_id" "text" NOT NULL,
    "trigger_key" "text" NOT NULL,
    "audience" "text" NOT NULL,
    "action_type" "text" NOT NULL,
    "status" "text" DEFAULT 'recommended'::"text" NOT NULL,
    "confidence" numeric(6,4),
    "decision_mode" "text" DEFAULT 'recommend'::"text" NOT NULL,
    "reason_en" "text" NOT NULL,
    "reason_ar" "text" NOT NULL,
    "data_sources" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "result" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "module" "text" DEFAULT 'automation'::"text" NOT NULL,
    "reversible" boolean DEFAULT true NOT NULL,
    "reversed_at" timestamp with time zone,
    "user_id" "uuid",
    "provider_id" "uuid",
    "service_request_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "ai_automation_actions_audience_check" CHECK (("audience" = ANY (ARRAY['customer'::"text", 'provider'::"text", 'admin'::"text", 'system'::"text"]))),
    CONSTRAINT "ai_automation_actions_confidence_check" CHECK ((("confidence" IS NULL) OR (("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric)))),
    CONSTRAINT "ai_automation_actions_decision_mode_check" CHECK (("decision_mode" = ANY (ARRAY['auto_execute'::"text", 'confirm'::"text", 'recommend'::"text", 'blocked'::"text"]))),
    CONSTRAINT "ai_automation_actions_status_check" CHECK (("status" = ANY (ARRAY['recommended'::"text", 'pending_confirmation'::"text", 'executed'::"text", 'failed'::"text", 'rejected'::"text", 'modified'::"text", 'reversed'::"text", 'blocked_safety'::"text"])))
);


ALTER TABLE "public"."ai_automation_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_automation_approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action_id" "uuid" NOT NULL,
    "audience" "text" NOT NULL,
    "user_id" "uuid",
    "provider_id" "uuid",
    "title_en" "text" NOT NULL,
    "title_ar" "text" NOT NULL,
    "body_en" "text" NOT NULL,
    "body_ar" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "modified_payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "ai_automation_approvals_audience_check" CHECK (("audience" = ANY (ARRAY['customer'::"text", 'provider'::"text", 'admin'::"text"]))),
    CONSTRAINT "ai_automation_approvals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'expired'::"text", 'modified'::"text"])))
);


ALTER TABLE "public"."ai_automation_approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_automation_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action_id" "uuid" NOT NULL,
    "suggested_action" "text" NOT NULL,
    "user_decision" "text" NOT NULL,
    "confidence_before" numeric(6,4),
    "confidence_delta" numeric(6,4),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_automation_feedback_user_decision_check" CHECK (("user_decision" = ANY (ARRAY['accepted'::"text", 'rejected'::"text", 'modified'::"text", 'ignored'::"text"])))
);


ALTER TABLE "public"."ai_automation_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_automation_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "policy_key" "text" DEFAULT 'default'::"text" NOT NULL,
    "auto_execute_min" numeric(5,4) DEFAULT 0.95 NOT NULL,
    "confirm_min" numeric(5,4) DEFAULT 0.80 NOT NULL,
    "recommend_below" numeric(5,4) DEFAULT 0.80 NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_automation_policies_auto_execute_min_check" CHECK ((("auto_execute_min" >= (0)::numeric) AND ("auto_execute_min" <= (1)::numeric))),
    CONSTRAINT "ai_automation_policies_confirm_min_check" CHECK ((("confirm_min" >= (0)::numeric) AND ("confirm_min" <= (1)::numeric))),
    CONSTRAINT "ai_automation_policies_recommend_below_check" CHECK ((("recommend_below" >= (0)::numeric) AND ("recommend_below" <= (1)::numeric)))
);


ALTER TABLE "public"."ai_automation_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_availability_forecasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "forecast_date" "date" NOT NULL,
    "predicted_free_hours" numeric(6,2) DEFAULT 0 NOT NULL,
    "predicted_bookings" integer DEFAULT 0 NOT NULL,
    "acceptance_probability" numeric(6,4),
    "expected_workload" "text",
    "confidence" numeric(6,4),
    "drivers" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "actual_bookings" integer,
    "compared_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_availability_forecasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_chat_action_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "message_id" "uuid",
    "title" "text" NOT NULL,
    "title_ar" "text",
    "kind" "text" DEFAULT 'other'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "assignee_role" "text",
    "confidence" numeric(4,3) DEFAULT 0.5 NOT NULL,
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "ai_chat_action_items_assignee_role_check" CHECK ((("assignee_role" IS NULL) OR ("assignee_role" = ANY (ARRAY['customer'::"text", 'provider'::"text", 'admin'::"text", 'either'::"text"])))),
    CONSTRAINT "ai_chat_action_items_kind_check" CHECK (("kind" = ANY (ARRAY['send_invoice'::"text", 'upload_photo'::"text", 'confirm_appointment'::"text", 'call_customer'::"text", 'order_materials'::"text", 'other'::"text"]))),
    CONSTRAINT "ai_chat_action_items_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text"]))),
    CONSTRAINT "ai_chat_action_items_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'completed'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."ai_chat_action_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_chat_action_items" IS 'Sprint 5 Phase 3 — detected tasks; AI never auto-sends messages.';



CREATE TABLE IF NOT EXISTS "public"."ai_chat_extractions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "message_id" "uuid",
    "field_key" "text" NOT NULL,
    "field_value" "text" NOT NULL,
    "confidence" numeric(4,3) DEFAULT 0.5 NOT NULL,
    "source" "text" DEFAULT 'ai'::"text" NOT NULL,
    "locale" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "ai_chat_extractions_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "ai_chat_extractions_field_key_check" CHECK (("field_key" = ANY (ARRAY['appointment'::"text", 'address'::"text", 'phone'::"text", 'budget'::"text", 'requested_date'::"text", 'service_type'::"text", 'materials'::"text", 'urgency'::"text", 'other'::"text"]))),
    CONSTRAINT "ai_chat_extractions_source_check" CHECK (("source" = ANY (ARRAY['ai'::"text", 'user'::"text", 'corrected'::"text"])))
);


ALTER TABLE "public"."ai_chat_extractions" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_chat_extractions" IS 'Sprint 5 Phase 3 — structured facts extracted from conversations for downstream workflows.';



CREATE TABLE IF NOT EXISTS "public"."ai_chat_preferences" (
    "user_id" "uuid" NOT NULL,
    "ai_enabled" boolean DEFAULT true NOT NULL,
    "preferred_language" "text",
    "auto_translate" boolean DEFAULT false NOT NULL,
    "allow_summaries" boolean DEFAULT true NOT NULL,
    "allow_suggestions" boolean DEFAULT true NOT NULL,
    "allow_extraction" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "allow_voice_transcription" boolean DEFAULT false NOT NULL,
    "voice_consent_at" timestamp with time zone,
    CONSTRAINT "ai_chat_preferences_preferred_language_check" CHECK ((("preferred_language" IS NULL) OR ("preferred_language" = ANY (ARRAY['en'::"text", 'ar'::"text", 'de'::"text", 'auto'::"text"]))))
);


ALTER TABLE "public"."ai_chat_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_chat_preferences" IS 'Sprint 5 Phase 3 — user opt-in/out for chat AI. Private chat content is not used for model training.';



CREATE TABLE IF NOT EXISTS "public"."ai_chat_sentiment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sentiment" "text" DEFAULT 'neutral'::"text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "score" numeric(4,3) DEFAULT 0.5 NOT NULL,
    "signals" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_chat_sentiment_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "ai_chat_sentiment_sentiment_check" CHECK (("sentiment" = ANY (ARRAY['positive'::"text", 'neutral'::"text", 'frustrated'::"text", 'urgent'::"text", 'escalation_risk'::"text"])))
);


ALTER TABLE "public"."ai_chat_sentiment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_chat_translations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "source_lang" "text" NOT NULL,
    "target_lang" "text" NOT NULL,
    "translated_text" "text" NOT NULL,
    "detected_lang" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_chat_translations_target_lang_check" CHECK (("target_lang" = ANY (ARRAY['en'::"text", 'ar'::"text", 'de'::"text"])))
);


ALTER TABLE "public"."ai_chat_translations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_conversation_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "service_request_id" "uuid",
    "audience" "text" NOT NULL,
    "summary" "jsonb" NOT NULL,
    "message_count" integer DEFAULT 0 NOT NULL,
    "source_hash" "text",
    "usefulness_rating" smallint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "window_key" "text" DEFAULT 'last_10'::"text" NOT NULL,
    "style_key" "text" DEFAULT 'short'::"text" NOT NULL,
    "generated_by" "text" DEFAULT 'rules'::"text" NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    CONSTRAINT "ai_conversation_summaries_audience_check" CHECK (("audience" = ANY (ARRAY['customer'::"text", 'provider'::"text", 'admin'::"text"]))),
    CONSTRAINT "ai_conversation_summaries_generated_by_check" CHECK (("generated_by" = ANY (ARRAY['rules'::"text", 'llm'::"text", 'hybrid'::"text"]))),
    CONSTRAINT "ai_conversation_summaries_style_key_check" CHECK (("style_key" = ANY (ARRAY['short'::"text", 'detailed'::"text", 'timeline'::"text", 'action'::"text"]))),
    CONSTRAINT "ai_conversation_summaries_usefulness_rating_check" CHECK ((("usefulness_rating" IS NULL) OR (("usefulness_rating" >= 1) AND ("usefulness_rating" <= 5)))),
    CONSTRAINT "ai_conversation_summaries_window_key_check" CHECK (("window_key" = ANY (ARRAY['last_10'::"text", 'today'::"text", 'last_7_days'::"text", 'entire'::"text"])))
);


ALTER TABLE "public"."ai_conversation_summaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_demand_forecasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "forecast_date" "date" NOT NULL,
    "hour_bucket" smallint,
    "city_id" "uuid",
    "category_slug" "text",
    "predicted_requests" numeric(10,2) DEFAULT 0 NOT NULL,
    "confidence" numeric(6,4),
    "drivers" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "model_version" "text" DEFAULT 'v8-heuristic'::"text" NOT NULL,
    "actual_requests" integer,
    "compared_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_demand_forecasts_confidence_check" CHECK ((("confidence" IS NULL) OR (("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric)))),
    CONSTRAINT "ai_demand_forecasts_hour_bucket_check" CHECK ((("hour_bucket" IS NULL) OR (("hour_bucket" >= 0) AND ("hour_bucket" <= 23))))
);


ALTER TABLE "public"."ai_demand_forecasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_dispatch_predictions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_request_id" "uuid",
    "provider_id" "uuid",
    "match_assignment_id" "uuid",
    "exposure_mode" character varying(32) DEFAULT 'limited_pool'::character varying NOT NULL,
    "response_band" character varying(16) DEFAULT 'medium'::character varying NOT NULL,
    "response_probability" numeric(6,4),
    "eta_minutes_min" integer,
    "eta_minutes_max" integer,
    "eta_label" "text",
    "predicted_duration_minutes" integer,
    "operational_score" numeric(5,2),
    "reputation_score" numeric(5,2),
    "distance_km" numeric(8,3),
    "capacity_remaining_minutes" integer,
    "route_fit" boolean DEFAULT false NOT NULL,
    "predicted_rank" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actual_responded_at" timestamp with time zone,
    "actual_accepted" boolean,
    "actual_arrived_at" timestamp with time zone,
    "actual_duration_minutes" integer,
    "actual_customer_chose" boolean,
    "compared_at" timestamp with time zone,
    CONSTRAINT "ai_dispatch_predictions_response_probability_check" CHECK ((("response_probability" IS NULL) OR (("response_probability" >= (0)::numeric) AND ("response_probability" <= (1)::numeric))))
);


ALTER TABLE "public"."ai_dispatch_predictions" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_dispatch_predictions" IS 'Phase 3 dispatch predictions for continuous learning. No exact live GPS stored.';



CREATE TABLE IF NOT EXISTS "public"."ai_intent_decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "normalized_text" "text" NOT NULL,
    "language" character varying(8) DEFAULT 'und'::character varying NOT NULL,
    "decision" "jsonb" NOT NULL,
    "confidence" numeric(6,4) DEFAULT 0 NOT NULL,
    "hit_count" integer DEFAULT 1 NOT NULL,
    "last_used_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_intent_decisions_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "ai_intent_decisions_hit_count_check" CHECK (("hit_count" >= 0))
);


ALTER TABLE "public"."ai_intent_decisions" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_intent_decisions" IS 'Cached AI intent decisions for repeated phrases. No PII beyond scrubbed text.';



CREATE TABLE IF NOT EXISTS "public"."ai_intent_memory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_request_id" "uuid",
    "customer_id" "uuid",
    "original_text" "text" NOT NULL,
    "normalized_text" "text" NOT NULL,
    "language" character varying(8),
    "dialect" character varying(32),
    "detected_category_slug" "text",
    "detected_subcategory" "text",
    "confidence" numeric(6,4),
    "questions_asked" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "final_category_slug" "text",
    "final_category_id" "uuid",
    "source" character varying(32) DEFAULT 'unknown'::character varying NOT NULL,
    "was_corrected" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_intent_memory_confidence_check" CHECK ((("confidence" IS NULL) OR (("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric)))),
    CONSTRAINT "ai_intent_memory_source_check" CHECK ((("source")::"text" = ANY ((ARRAY['knowledge'::character varying, 'rules'::character varying, 'llm'::character varying, 'user'::character varying, 'hybrid'::character varying, 'unknown'::character varying])::"text"[])))
);


ALTER TABLE "public"."ai_intent_memory" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_intent_memory" IS 'Append-only AI memory of intent interactions. Never UPDATE historical rows — always INSERT.';



CREATE TABLE IF NOT EXISTS "public"."ai_job_analyses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_request_id" "uuid",
    "booking_id" "uuid",
    "service_key" "text",
    "category_slug" "text",
    "analysis" "jsonb" NOT NULL,
    "confidence" numeric(6,4),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actual_duration_minutes" integer,
    "actual_materials" "jsonb",
    "actual_complexity" character varying(16),
    "compared_at" timestamp with time zone,
    CONSTRAINT "ai_job_analyses_confidence_check" CHECK ((("confidence" IS NULL) OR (("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))))
);


ALTER TABLE "public"."ai_job_analyses" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_job_analyses" IS 'Per-request job intelligence snapshot + post-completion learning deltas.';



CREATE TABLE IF NOT EXISTS "public"."ai_knowledge_phrases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phrase" "text" NOT NULL,
    "normalized_phrase" "text" NOT NULL,
    "category_slug" "text" NOT NULL,
    "subcategory" "text",
    "language" character varying(8) DEFAULT 'und'::character varying NOT NULL,
    "dialect" character varying(32),
    "confidence" numeric(6,4) DEFAULT 0.5000 NOT NULL,
    "occurrences" integer DEFAULT 1 NOT NULL,
    "confirmations" integer DEFAULT 0 NOT NULL,
    "corrections" integer DEFAULT 0 NOT NULL,
    "success_rate" numeric(6,4) DEFAULT 0.5000 NOT NULL,
    "last_used_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "ai_knowledge_phrases_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "ai_knowledge_phrases_confirmations_check" CHECK (("confirmations" >= 0)),
    CONSTRAINT "ai_knowledge_phrases_corrections_check" CHECK (("corrections" >= 0)),
    CONSTRAINT "ai_knowledge_phrases_occurrences_check" CHECK (("occurrences" >= 0)),
    CONSTRAINT "ai_knowledge_phrases_success_rate_check" CHECK ((("success_rate" >= (0)::numeric) AND ("success_rate" <= (1)::numeric)))
);


ALTER TABLE "public"."ai_knowledge_phrases" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_knowledge_phrases" IS 'Structured phrase→category knowledge. Aggregates only — no PII. Fast path before LLM.';



CREATE TABLE IF NOT EXISTS "public"."ai_marketplace_balances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "snapshot_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category_slug" "text",
    "city_id" "uuid",
    "open_requests" integer DEFAULT 0 NOT NULL,
    "available_providers" integer DEFAULT 0 NOT NULL,
    "imbalance_ratio" numeric(10,4),
    "severity" "text" DEFAULT 'balanced'::"text" NOT NULL,
    "recommended_actions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_marketplace_balances_severity_check" CHECK (("severity" = ANY (ARRAY['balanced'::"text", 'mild'::"text", 'shortage'::"text", 'critical_shortage'::"text", 'oversupply'::"text"])))
);


ALTER TABLE "public"."ai_marketplace_balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_marketplace_path_stats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "path" "text" NOT NULL,
    "recommendation_accepted" integer DEFAULT 0 NOT NULL,
    "recommendation_ignored" integer DEFAULT 0 NOT NULL,
    "choices" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_marketplace_path_stats_path_check" CHECK (("path" = ANY (ARRAY['publish'::"text", 'find'::"text"])))
);


ALTER TABLE "public"."ai_marketplace_path_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_offer_comparisons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_request_id" "uuid" NOT NULL,
    "comparison" "jsonb" NOT NULL,
    "offer_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_offer_comparisons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_prediction_outcomes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "prediction_type" "text" NOT NULL,
    "reference_id" "uuid",
    "predicted" "jsonb" NOT NULL,
    "actual" "jsonb",
    "error_metric" numeric(12,4),
    "was_correct" boolean,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "compared_at" timestamp with time zone
);


ALTER TABLE "public"."ai_prediction_outcomes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_predictive_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "audience" "text" NOT NULL,
    "user_id" "uuid",
    "provider_id" "uuid",
    "notification_type" "text" NOT NULL,
    "title_en" "text" NOT NULL,
    "title_ar" "text" NOT NULL,
    "body_en" "text" NOT NULL,
    "body_ar" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "ai_predictive_notifications_audience_check" CHECK (("audience" = ANY (ARRAY['customer'::"text", 'provider'::"text", 'admin'::"text"]))),
    CONSTRAINT "ai_predictive_notifications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'shown'::"text", 'clicked'::"text", 'dismissed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."ai_predictive_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_proactive_suggestions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_request_id" "uuid",
    "booking_id" "uuid",
    "provider_id" "uuid",
    "customer_id" "uuid",
    "audience" "text" NOT NULL,
    "suggestion_type" "text" NOT NULL,
    "title_en" "text" NOT NULL,
    "title_ar" "text" NOT NULL,
    "body_en" "text" NOT NULL,
    "body_ar" "text" NOT NULL,
    "action_key" "text",
    "priority" integer DEFAULT 50 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "ai_proactive_suggestions_audience_check" CHECK (("audience" = ANY (ARRAY['customer'::"text", 'provider'::"text"]))),
    CONSTRAINT "ai_proactive_suggestions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'shown'::"text", 'accepted'::"text", 'ignored'::"text", 'rejected'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."ai_proactive_suggestions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_provider_automation_settings" (
    "provider_id" "uuid" NOT NULL,
    "auto_accept_enabled" boolean DEFAULT false NOT NULL,
    "auto_reject_out_of_area" boolean DEFAULT true NOT NULL,
    "auto_reject_outside_hours" boolean DEFAULT true NOT NULL,
    "suggest_route_optimization" boolean DEFAULT true NOT NULL,
    "suggest_schedule_gaps" boolean DEFAULT true NOT NULL,
    "min_auto_accept_confidence" numeric(5,4) DEFAULT 0.95 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_provider_automation_setting_min_auto_accept_confidence_check" CHECK ((("min_auto_accept_confidence" >= 0.8) AND ("min_auto_accept_confidence" <= (1)::numeric)))
);


ALTER TABLE "public"."ai_provider_automation_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_provider_reputation" (
    "provider_id" "uuid" NOT NULL,
    "reputation_score" numeric(5,2) DEFAULT 50 NOT NULL,
    "factors" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sample_size" integer DEFAULT 0 NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_provider_reputation_reputation_score_check" CHECK ((("reputation_score" >= (0)::numeric) AND ("reputation_score" <= (100)::numeric)))
);


ALTER TABLE "public"."ai_provider_reputation" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_provider_reputation" IS 'Dynamic reputation 0–100. One ranking factor among many — never sole dispatch criterion.';



CREATE TABLE IF NOT EXISTS "public"."ai_service_knowledge" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_key" "text" NOT NULL,
    "category_slug" "text" NOT NULL,
    "subcategory" "text",
    "typical_problems" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "common_causes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "required_skills" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "typical_tools" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "common_materials" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "duration_min_minutes" integer,
    "duration_typical_minutes" integer,
    "duration_max_minutes" integer,
    "complexity" character varying(16) DEFAULT 'moderate'::character varying NOT NULL,
    "emergency_capable" boolean DEFAULT false NOT NULL,
    "certifications" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "price_min" numeric(12,2),
    "price_typical" numeric(12,2),
    "price_max" numeric(12,2),
    "price_currency" character varying(8) DEFAULT 'SYP'::character varying NOT NULL,
    "related_trades" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "match_keywords" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sample_size" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_service_knowledge_complexity_check" CHECK ((("complexity")::"text" = ANY ((ARRAY['simple'::character varying, 'moderate'::character varying, 'complex'::character varying])::"text"[])))
);


ALTER TABLE "public"."ai_service_knowledge" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_service_knowledge" IS 'Structured service/job knowledge. Seeded + improved by post-job learning.';



CREATE TABLE IF NOT EXISTS "public"."ai_vision_analyses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_hash" "text" NOT NULL,
    "service_request_id" "uuid",
    "image_path" "text",
    "mime_type" "text",
    "byte_size" integer,
    "analysis" "jsonb" NOT NULL,
    "fusion" "jsonb",
    "customer_summary_en" "text",
    "customer_summary_ar" "text",
    "customer_confirmed" boolean,
    "customer_correction" "text",
    "confidence" numeric(6,4),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actual_damage" "jsonb",
    "actual_tools" "jsonb",
    "actual_materials" "jsonb",
    "compared_at" timestamp with time zone,
    CONSTRAINT "ai_vision_analyses_confidence_check" CHECK ((("confidence" IS NULL) OR (("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))))
);


ALTER TABLE "public"."ai_vision_analyses" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_vision_analyses" IS 'Cached Vision Intelligence analyses. Hash-deduped to skip duplicate API calls.';



CREATE TABLE IF NOT EXISTS "public"."ai_voice_transcripts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_hash" "text" NOT NULL,
    "service_request_id" "uuid",
    "audio_path" "text",
    "audio_bucket" "text",
    "mime_type" "text",
    "byte_size" integer,
    "original_transcript" "text" NOT NULL,
    "normalized_transcript" "text" NOT NULL,
    "edited_transcript" "text",
    "language" "text",
    "dialect" "text",
    "language_confidence" numeric(6,4),
    "interpretation" "jsonb",
    "fusion" "jsonb",
    "detected_category_slug" "text",
    "detected_urgency" "text",
    "summary_en" "text",
    "summary_ar" "text",
    "customer_confirmed" boolean,
    "customer_correction" "text",
    "confidence" numeric(6,4),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "final_category_slug" "text",
    "compared_at" timestamp with time zone,
    CONSTRAINT "ai_voice_transcripts_confidence_check" CHECK ((("confidence" IS NULL) OR (("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric)))),
    CONSTRAINT "ai_voice_transcripts_language_confidence_check" CHECK ((("language_confidence" IS NULL) OR (("language_confidence" >= (0)::numeric) AND ("language_confidence" <= (1)::numeric))))
);


ALTER TABLE "public"."ai_voice_transcripts" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_voice_transcripts" IS 'Cached Voice Intelligence transcripts. Hash-deduped to skip duplicate STT calls.';



CREATE TABLE IF NOT EXISTS "public"."ai_wait_time_estimates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_slug" "text" NOT NULL,
    "city_id" "uuid",
    "response_min_minutes" integer,
    "response_max_minutes" integer,
    "arrival_min_minutes" integer,
    "arrival_max_minutes" integer,
    "confidence" numeric(6,4),
    "sample_size" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_wait_time_estimates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "action" "public"."audit_action" NOT NULL,
    "entity_type" character varying(50) NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_analytics_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "booking_id" "uuid",
    "provider_id" "uuid",
    "actor_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "booking_analytics_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['booking_created'::"text", 'booking_accepted'::"text", 'booking_declined'::"text", 'booking_cancelled'::"text", 'booking_completed'::"text", 'booking_rescheduled'::"text", 'booking_expired'::"text", 'completion_confirmed'::"text", 'issue_reported'::"text", 'review_submitted'::"text", 'completion_prompt_sent'::"text"])))
);


ALTER TABLE "public"."booking_analytics_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "uploader_id" "uuid" NOT NULL,
    "bucket" "text" DEFAULT 'booking-attachments'::"text" NOT NULL,
    "path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "size_bytes" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."booking_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_issue_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "moderation_status" "text" DEFAULT 'open'::"text" NOT NULL,
    "assigned_to" "uuid",
    "admin_notes" "text",
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    CONSTRAINT "booking_issue_reports_moderation_status_check" CHECK (("moderation_status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'resolved'::"text", 'closed'::"text"]))),
    CONSTRAINT "booking_issue_reports_reason_check" CHECK (("reason" = ANY (ARRAY['provider_never_arrived'::"text", 'provider_cancelled'::"text", 'work_incomplete'::"text", 'poor_quality'::"text", 'need_another_visit'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."booking_issue_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "is_internal" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."booking_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_reminder_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "reminder_type" "text" NOT NULL,
    "channel" "text" DEFAULT 'in_app'::"text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "booking_reminder_log_channel_check" CHECK (("channel" = ANY (ARRAY['in_app'::"text", 'email'::"text", 'push'::"text"]))),
    CONSTRAINT "booking_reminder_log_reminder_type_check" CHECK (("reminder_type" = ANY (ARRAY['24h'::"text", '2h'::"text", '1h'::"text", 'custom'::"text", 'completion_prompt'::"text", 'on_the_way'::"text", 'appointment_changed'::"text", 'after_completion'::"text"])))
);


ALTER TABLE "public"."booking_reminder_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_slot_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid",
    "provider_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "suggested_starts_at" timestamp with time zone NOT NULL,
    "suggested_rank" smallint,
    "decision" "text" NOT NULL,
    "appointment_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "booking_slot_feedback_decision_check" CHECK (("decision" = ANY (ARRAY['accepted'::"text", 'rejected'::"text", 'ignored'::"text", 'modified'::"text"])))
);


ALTER TABLE "public"."booking_slot_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_status_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "actor_id" "uuid",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."booking_status_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "service_id" "uuid",
    "service_request_id" "uuid",
    "conversation_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "duration_minutes" integer NOT NULL,
    "timezone" "text" DEFAULT 'Asia/Damascus'::"text" NOT NULL,
    "location_text" "text",
    "location_lat" double precision,
    "location_lng" double precision,
    "customer_notes" "text",
    "provider_notes" "text",
    "preferred_contact" "text",
    "requires_provider_confirmation" boolean DEFAULT true NOT NULL,
    "is_recurring" boolean DEFAULT false NOT NULL,
    "recurrence_rule" "text",
    "parent_booking_id" "uuid",
    "cancelled_by" "uuid",
    "cancel_reason" "text",
    "declined_reason" "text",
    "confirmed_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "customer_confirmed_at" timestamp with time zone,
    "completion_prompted_at" timestamp with time zone,
    "issue_reason" "text",
    "issue_reported_at" timestamp with time zone,
    "appointment_type" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "travel_buffer_minutes" integer,
    "suggested_slot_rank" smallint,
    "recurring_plan_id" "uuid",
    "recurring_visit_id" "uuid",
    CONSTRAINT "bookings_appointment_type_check" CHECK (("appointment_type" = ANY (ARRAY['immediate'::"text", 'today'::"text", 'scheduled'::"text", 'recurring'::"text", 'emergency'::"text", 'video'::"text"]))),
    CONSTRAINT "bookings_duration_minutes_check" CHECK (("duration_minutes" = ANY (ARRAY[15, 30, 60, 90, 120]))),
    CONSTRAINT "bookings_issue_reason_check" CHECK ((("issue_reason" IS NULL) OR ("issue_reason" = ANY (ARRAY['provider_never_arrived'::"text", 'provider_cancelled'::"text", 'work_incomplete'::"text", 'poor_quality'::"text", 'need_another_visit'::"text", 'other'::"text"])))),
    CONSTRAINT "bookings_preferred_contact_check" CHECK ((("preferred_contact" IS NULL) OR ("preferred_contact" = ANY (ARRAY['chat'::"text", 'phone'::"text", 'whatsapp'::"text"])))),
    CONSTRAINT "bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'declined'::"text", 'cancelled'::"text", 'completed'::"text", 'rescheduled'::"text", 'expired'::"text", 'awaiting_customer_confirmation'::"text", 'customer_confirmed'::"text", 'issue_reported'::"text"]))),
    CONSTRAINT "bookings_time_order" CHECK (("ends_at" > "starts_at")),
    CONSTRAINT "bookings_travel_buffer_minutes_check" CHECK ((("travel_buffer_minutes" IS NULL) OR (("travel_buffer_minutes" >= 0) AND ("travel_buffer_minutes" <= 120))))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_assistant_experiments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "experiment_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "algorithm_a" "text" DEFAULT 'business-v1'::"text" NOT NULL,
    "algorithm_b" "text" DEFAULT 'business-ml-v0'::"text" NOT NULL,
    "traffic_b_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT false NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_assistant_experiments_traffic_b_pct_check" CHECK ((("traffic_b_pct" >= (0)::numeric) AND ("traffic_b_pct" <= (100)::numeric)))
);


ALTER TABLE "public"."business_assistant_experiments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_benchmarks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "region_key" "text" DEFAULT 'all'::"text" NOT NULL,
    "category_key" "text" DEFAULT 'all'::"text" NOT NULL,
    "cohort" "text" DEFAULT 'average'::"text" NOT NULL,
    "percentile" numeric(8,4),
    "metrics" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_benchmarks_cohort_check" CHECK (("cohort" = ANY (ARRAY['top_20'::"text", 'above_average'::"text", 'average'::"text", 'improving'::"text", 'below_average'::"text"])))
);


ALTER TABLE "public"."business_benchmarks" OWNER TO "postgres";


COMMENT ON TABLE "public"."business_benchmarks" IS 'Anonymous cohort labels only — never competitor identities.';



CREATE TABLE IF NOT EXISTS "public"."business_briefings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "briefing_date" "date" NOT NULL,
    "summary_en" "text" NOT NULL,
    "summary_ar" "text",
    "sections" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "algorithm_version" "text" DEFAULT 'business-v1'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."business_briefings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_goal_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "recorded_value" numeric(14,4) NOT NULL,
    "progress_pct" numeric(8,4),
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."business_goal_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "goal_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "target_value" numeric(14,4) NOT NULL,
    "current_value" numeric(14,4) DEFAULT 0 NOT NULL,
    "unit" "text",
    "period" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "starts_at" "date",
    "ends_at" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_goals_goal_type_check" CHECK (("goal_type" = ANY (ARRAY['revenue'::"text", 'bookings'::"text", 'rating'::"text", 'response_time'::"text", 'completion_rate'::"text", 'repeat_customers'::"text", 'custom'::"text"]))),
    CONSTRAINT "business_goals_period_check" CHECK (("period" = ANY (ARRAY['weekly'::"text", 'monthly'::"text", 'quarterly'::"text", 'yearly'::"text"])))
);


ALTER TABLE "public"."business_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_health" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "health_score" numeric(8,4) DEFAULT 0.5 NOT NULL,
    "revenue_score" numeric(8,4),
    "booking_score" numeric(8,4),
    "quality_score" numeric(8,4),
    "trust_score" numeric(8,4),
    "capacity_score" numeric(8,4),
    "trend" "text" DEFAULT 'stable'::"text" NOT NULL,
    "metrics" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_health_trend_check" CHECK (("trend" = ANY (ARRAY['rising'::"text", 'stable'::"text", 'declining'::"text"])))
);


ALTER TABLE "public"."business_health" OWNER TO "postgres";


COMMENT ON TABLE "public"."business_health" IS 'Sprint 8 Phase 5 — provider business health (own data only).';



CREATE TABLE IF NOT EXISTS "public"."business_insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "label_en" "text" NOT NULL,
    "label_ar" "text",
    "severity" "text" DEFAULT 'info'::"text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "algorithm_version" "text" DEFAULT 'business-v1'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_insights_category_check" CHECK (("category" = ANY (ARRAY['revenue'::"text", 'bookings'::"text", 'quality'::"text", 'growth'::"text", 'capacity'::"text", 'reputation'::"text", 'general'::"text"]))),
    CONSTRAINT "business_insights_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'positive'::"text", 'warning'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."business_insights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_recommendations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "title_en" "text" NOT NULL,
    "title_ar" "text",
    "body_en" "text",
    "body_ar" "text",
    "priority" numeric(8,4) DEFAULT 0.5 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "algorithm_version" "text" DEFAULT 'business-v1'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "decided_at" timestamp with time zone,
    CONSTRAINT "business_recommendations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'dismissed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."business_recommendations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_subscription_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "monetization_plan_id" "uuid",
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "renewal" boolean DEFAULT false NOT NULL,
    "activated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_subscription_id" "text",
    "stripe_invoice_id" "text",
    "stripe_checkout_session_id" "text"
);


ALTER TABLE "public"."business_subscription_payments" OWNER TO "postgres";


COMMENT ON TABLE "public"."business_subscription_payments" IS 'Sprint 6 Phase 2 — Business $20/mo subscription payment periods.';



CREATE TABLE IF NOT EXISTS "public"."capacity_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "day" "date" NOT NULL,
    "max_daily_jobs" integer,
    "max_weekly_jobs" integer,
    "jobs_booked" integer DEFAULT 0 NOT NULL,
    "remaining_capacity" integer,
    "available_capacity" integer,
    "overbooking_risk" numeric(8,4),
    "burnout_risk" numeric(8,4),
    "vacation_mode" boolean DEFAULT false NOT NULL,
    "pause_mode" boolean DEFAULT false NOT NULL,
    "workload_score" numeric(8,4),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."capacity_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."capacity_predictions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid",
    "horizon" "text" DEFAULT '7d'::"text" NOT NULL,
    "predicted_jobs" numeric(10,2),
    "predicted_utilization" numeric(8,4),
    "burnout_risk" numeric(8,4),
    "algorithm_version" "text" DEFAULT 'schedule-v1'::"text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."capacity_predictions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "module_id" "uuid" NOT NULL,
    "parent_id" "uuid",
    "slug" character varying(80) NOT NULL,
    "name" "jsonb" NOT NULL,
    "description" "jsonb",
    "icon" character varying(50),
    "depth" smallint DEFAULT 0 NOT NULL,
    "sort_order" smallint DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."category_health" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "text" NOT NULL,
    "category_name" "text",
    "trust_level" "text" DEFAULT 'developing'::"text" NOT NULL,
    "growth_pct" numeric(10,4),
    "complaint_rate" numeric(8,4),
    "cancellation_rate" numeric(8,4),
    "average_rating" numeric(4,2),
    "completion_rate" numeric(8,4),
    "customer_satisfaction" numeric(4,2),
    "booking_count" integer DEFAULT 0 NOT NULL,
    "provider_count" integer DEFAULT 0 NOT NULL,
    "health_score" numeric(8,4) DEFAULT 0 NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "category_health_trust_level_check" CHECK (("trust_level" = ANY (ARRAY['excellent'::"text", 'very_good'::"text", 'good'::"text", 'developing'::"text", 'new_provider'::"text", 'needs_attention'::"text"])))
);


ALTER TABLE "public"."category_health" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cell_policies" (
    "cell_key" "text" NOT NULL,
    "city_id" "uuid",
    "category_id" "uuid",
    "frozen" boolean DEFAULT false NOT NULL,
    "limited_availability" boolean DEFAULT false NOT NULL,
    "concierge" boolean DEFAULT false NOT NULL,
    "note" "text",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cell_policies_flags_check" CHECK (((NOT ("frozen" AND "limited_availability")) OR true))
);


ALTER TABLE "public"."cell_policies" OWNER TO "postgres";


COMMENT ON TABLE "public"."cell_policies" IS 'Sprint 9: city×category marketplace cell overrides. frozen blocks matching; limited_availability shrinks pool; concierge marks ops-assisted cells.';



CREATE TABLE IF NOT EXISTS "public"."chat_analytics_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "conversation_id" "uuid",
    "actor_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chat_analytics_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['conversation_created'::"text", 'message_sent'::"text", 'message_read'::"text", 'attachment_sent'::"text", 'conversation_closed'::"text", 'first_response'::"text"])))
);


ALTER TABLE "public"."chat_analytics_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_voice_transcript_translations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transcript_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "target_lang" "text" NOT NULL,
    "translated_text" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chat_voice_transcript_translations_target_lang_check" CHECK (("target_lang" = ANY (ARRAY['en'::"text", 'ar'::"text", 'de'::"text"])))
);


ALTER TABLE "public"."chat_voice_transcript_translations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_voice_transcripts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "message_id" "uuid" NOT NULL,
    "attachment_id" "uuid",
    "media_object_id" "uuid",
    "language" "text",
    "transcript_text" "text" DEFAULT ''::"text" NOT NULL,
    "summary_text" "text",
    "summary_bullets" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "extracted" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_code" "text",
    "duration_ms" integer,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "chat_voice_transcripts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'ready'::"text", 'failed'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."chat_voice_transcripts" OWNER TO "postgres";


COMMENT ON TABLE "public"."chat_voice_transcripts" IS 'Sprint 5 Phase 4 — deletable voice transcripts. Original recordings stay in private storage. Not used for model training.';



CREATE TABLE IF NOT EXISTS "public"."cities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" character varying(80) NOT NULL,
    "name" "jsonb" NOT NULL,
    "country_code" character(2) DEFAULT 'SY'::"bpchar" NOT NULL,
    "latitude" numeric(10,7),
    "longitude" numeric(10,7),
    "population" integer,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" smallint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_billing_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_name" "text" DEFAULT 'Dalily'::"text" NOT NULL,
    "company_address" "text" DEFAULT ''::"text" NOT NULL,
    "country" "text" DEFAULT 'Syria'::"text" NOT NULL,
    "vat_number" "text" DEFAULT ''::"text" NOT NULL,
    "tax_id" "text" DEFAULT ''::"text" NOT NULL,
    "support_email" "text" DEFAULT 'support@dalily.app'::"text" NOT NULL,
    "website" "text" DEFAULT 'https://dalily.app'::"text" NOT NULL,
    "phone" "text" DEFAULT ''::"text" NOT NULL,
    "invoice_footer" "text" DEFAULT 'Thank you for doing business with Dalily.'::"text" NOT NULL,
    "legal_notice" "text" DEFAULT ''::"text" NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "default_tax_rate" numeric(6,4) DEFAULT 0 NOT NULL,
    "logo_path" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."company_billing_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_release_grants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unlock_session_id" "uuid",
    "service_request_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "scope" "jsonb" DEFAULT '["phone", "whatsapp", "address", "chat"]'::"jsonb" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'unlock'::"text" NOT NULL,
    CONSTRAINT "contact_release_grants_source_check" CHECK (("source" = ANY (ARRAY['unlock'::"text", 'legacy_backfill'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."contact_release_grants" OWNER TO "postgres";


COMMENT ON TABLE "public"."contact_release_grants" IS 'Contact/PII release only after unlock success. Checked by Chat in Sprint 7.';



COMMENT ON COLUMN "public"."contact_release_grants"."source" IS 'unlock = Sprint 5/6 path; legacy_backfill = Sprint 7 soft-break for in-flight chats';



CREATE TABLE IF NOT EXISTS "public"."conversation_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "last_read_at" timestamp with time zone,
    "last_delivered_at" timestamp with time zone,
    "muted" boolean DEFAULT false NOT NULL,
    "pinned" boolean DEFAULT false NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "conversation_participants_role_check" CHECK (("role" = ANY (ARRAY['customer'::"text", 'provider'::"text", 'member'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."conversation_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_typing" (
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:00:06'::interval) NOT NULL
);


ALTER TABLE "public"."conversation_typing" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "service_request_id" "uuid",
    "last_message_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "pinned_by_customer" boolean DEFAULT false NOT NULL,
    "pinned_by_provider" boolean DEFAULT false NOT NULL,
    "archived_by_customer" boolean DEFAULT false NOT NULL,
    "archived_by_provider" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "thread_kind" "text" DEFAULT 'legacy'::"text" NOT NULL,
    "project_id" "uuid",
    "package_id" "uuid",
    "chat_scope" "text" DEFAULT 'request'::"text" NOT NULL,
    "admin_user_id" "uuid",
    "emergency_dispatch_id" "uuid",
    CONSTRAINT "conversations_chat_scope_check" CHECK (("chat_scope" = ANY (ARRAY['request'::"text", 'project'::"text", 'package'::"text", 'emergency'::"text", 'admin'::"text", 'support'::"text"]))),
    CONSTRAINT "conversations_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text", 'archived'::"text"]))),
    CONSTRAINT "conversations_thread_kind_check" CHECK (("thread_kind" = ANY (ARRAY['legacy'::"text", 'full'::"text"])))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."conversations"."thread_kind" IS 'legacy = pre-grant status dual-run; full = grant-gated marketplace chat (Sprint 7)';



CREATE TABLE IF NOT EXISTS "public"."credit_note_metadata" (
    "document_id" "uuid" NOT NULL,
    "refund_request_id" "uuid",
    "original_document_id" "uuid",
    "original_document_number" "text",
    "refund_amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."credit_note_metadata" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_preference_profiles" (
    "customer_id" "uuid" NOT NULL,
    "prefer_nearby" numeric(6,4) DEFAULT 0.5000 NOT NULL,
    "prefer_premium" numeric(6,4) DEFAULT 0.5000 NOT NULL,
    "prefer_high_rating" numeric(6,4) DEFAULT 0.5000 NOT NULL,
    "prefer_fast_response" numeric(6,4) DEFAULT 0.5000 NOT NULL,
    "sample_size" integer DEFAULT 0 NOT NULL,
    "factors" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."customer_preference_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."customer_preference_profiles" IS 'Learned customer preference weights (0–1). Used only as a small personalization signal.';



CREATE TABLE IF NOT EXISTS "public"."customer_preferences" (
    "customer_id" "uuid" NOT NULL,
    "preferred_language" "text",
    "preferred_gender" "text",
    "budget_min" numeric(12,2),
    "budget_max" numeric(12,2),
    "preferred_response_speed" "text",
    "favourite_provider_ids" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "preferred_hours" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "favourite_categories" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "frequent_locations" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "learned_profile" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_preferences_preferred_response_speed_check" CHECK ((("preferred_response_speed" IS NULL) OR ("preferred_response_speed" = ANY (ARRAY['fast'::"text", 'normal'::"text", 'flexible'::"text"]))))
);


ALTER TABLE "public"."customer_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dispute_evidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dispute_id" "uuid" NOT NULL,
    "uploaded_by" "uuid",
    "storage_path" "text" NOT NULL,
    "file_name" "text",
    "mime_type" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dispute_evidence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_download_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "actor_user_id" "uuid",
    "actor_role" "text",
    "ip_hash" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."document_download_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_number_sequences" (
    "prefix" "text" NOT NULL,
    "year" integer NOT NULL,
    "last_value" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "document_number_sequences_last_value_check" CHECK (("last_value" >= 0)),
    CONSTRAINT "document_number_sequences_prefix_check" CHECK (("prefix" = ANY (ARRAY['INV'::"text", 'RCP'::"text", 'CRN'::"text"])))
);


ALTER TABLE "public"."document_number_sequences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emergency_dispatch_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dispatch_id" "uuid" NOT NULL,
    "service_request_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "assignment_id" "uuid",
    "response" "text" NOT NULL,
    "responded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "eta_minutes" integer,
    "note" "text",
    CONSTRAINT "emergency_dispatch_responses_response_check" CHECK (("response" = ANY (ARRAY['notified'::"text", 'accepted'::"text", 'declined'::"text", 'busy'::"text", 'on_the_way'::"text", 'arrived'::"text", 'started'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."emergency_dispatch_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emergency_dispatches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_request_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'dispatching'::"text" NOT NULL,
    "activated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stopped_at" timestamp with time zone,
    "accepted_provider_id" "uuid",
    "accepted_assignment_id" "uuid",
    "target_accepts" integer DEFAULT 1 NOT NULL,
    "notified_count" integer DEFAULT 0 NOT NULL,
    "accepted_count" integer DEFAULT 0 NOT NULL,
    "eta_minutes_min" integer,
    "eta_minutes_max" integer,
    "eta_label" "text",
    "eta_updated_at" timestamp with time zone,
    "dispatch_duration_seconds" integer,
    "city_id" "uuid",
    "category_slug" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "emergency_dispatches_status_check" CHECK (("status" = ANY (ARRAY['detected'::"text", 'dispatching'::"text", 'awaiting_accept'::"text", 'accepted'::"text", 'on_the_way'::"text", 'arrived'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text", 'stopped'::"text"]))),
    CONSTRAINT "emergency_dispatches_target_accepts_check" CHECK ((("target_accepts" >= 1) AND ("target_accepts" <= 5)))
);


ALTER TABLE "public"."emergency_dispatches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emergency_live_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dispatch_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "service_request_id" "uuid" NOT NULL,
    "latitude" double precision NOT NULL,
    "longitude" double precision NOT NULL,
    "accuracy_m" double precision,
    "heading" double precision,
    "speed_kmh" double precision,
    "sharing_enabled" boolean DEFAULT true NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."emergency_live_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emergency_timeline_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dispatch_id" "uuid" NOT NULL,
    "service_request_id" "uuid" NOT NULL,
    "event_key" "text" NOT NULL,
    "label_en" "text" NOT NULL,
    "label_ar" "text" NOT NULL,
    "actor" "text" DEFAULT 'system'::"text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "emergency_timeline_events_actor_check" CHECK (("actor" = ANY (ARRAY['system'::"text", 'customer'::"text", 'provider'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."emergency_timeline_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_relationships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_entity_type" "text" NOT NULL,
    "from_entity_id" "text" NOT NULL,
    "to_entity_type" "text" NOT NULL,
    "to_entity_id" "text" NOT NULL,
    "relationship_type" "text" NOT NULL,
    "confirmed" boolean DEFAULT false NOT NULL,
    "confidence" numeric(5,4) DEFAULT 0.5 NOT NULL,
    "evidence" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "entity_relationships_relationship_type_check" CHECK (("relationship_type" = ANY (ARRAY['same_owner'::"text", 'same_payment_method'::"text", 'shared_booking'::"text", 'shared_review'::"text", 'shared_device'::"text", 'shared_ip'::"text", 'linked_case'::"text", 'verification_link'::"text", 'duplicate_candidate'::"text", 'investigation_link'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."entity_relationships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_analytics_cache" (
    "cache_key" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "computed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."finance_analytics_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "subscription_id" "uuid",
    "payment_provider" "public"."payment_provider" DEFAULT 'manual'::"public"."payment_provider" NOT NULL,
    "payment_status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    "external_transaction_id" "text",
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payment_reference" "text" NOT NULL,
    "receipt_path" "text",
    "receipt_mime_type" "text",
    "submitted_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "rejected_at" timestamp with time zone,
    "rejected_by" "uuid",
    "admin_note" "text",
    "purpose" "text" DEFAULT 'subscription'::"text" NOT NULL,
    "unlock_session_id" "uuid",
    "idempotency_key" "text",
    "failed_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "provider_reference" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "stripe_payment_intent_id" "text",
    "stripe_checkout_session_id" "text",
    "stripe_invoice_id" "text",
    "stripe_charge_id" "text",
    "refunded_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "refund_status" "text",
    CONSTRAINT "payments_purpose_check" CHECK (("purpose" = ANY (ARRAY['subscription'::"text", 'business_subscription'::"text", 'unlock_fee'::"text", 'lead_unlock'::"text", 'refund'::"text", 'credit'::"text", 'wallet'::"text", 'invoice'::"text"]))),
    CONSTRAINT "payments_refund_status_check" CHECK ((("refund_status" IS NULL) OR ("refund_status" = ANY (ARRAY['none'::"text", 'partial'::"text", 'full'::"text", 'pending'::"text"]))))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."payments"."purpose" IS 'subscription (legacy) | unlock_fee (Dalily 2.0 Sprint 6)';



COMMENT ON COLUMN "public"."payments"."unlock_session_id" IS 'Set when purpose=unlock_fee. Capture correlates to contact_release_grants.';



COMMENT ON COLUMN "public"."payments"."stripe_payment_intent_id" IS 'Sprint 6 Phase 3 — Stripe PaymentIntent id for lead unlocks.';



CREATE OR REPLACE VIEW "public"."finance_paid_payments_v" AS
 SELECT "id",
    "provider_id",
    "purpose",
    "currency",
    ("amount")::numeric AS "gross_amount",
    COALESCE("refunded_amount", (0)::numeric) AS "refunded_amount",
    ("amount" - COALESCE("refunded_amount", (0)::numeric)) AS "net_amount",
    "payment_status",
    "refund_status",
    "payment_reference",
    "paid_at",
    "created_at",
    ("date_trunc"('day'::"text", COALESCE("paid_at", "created_at")))::"date" AS "paid_day",
    ("date_trunc"('month'::"text", COALESCE("paid_at", "created_at")))::"date" AS "paid_month"
   FROM "public"."payments" "p"
  WHERE ("payment_status" = 'paid'::"public"."payment_status");


ALTER VIEW "public"."finance_paid_payments_v" OWNER TO "postgres";


COMMENT ON VIEW "public"."finance_paid_payments_v" IS 'Sprint 6 Phase 6 — read-only paid payments with net revenue (no data duplication).';



CREATE OR REPLACE VIEW "public"."finance_daily_revenue_v" AS
 SELECT "paid_day" AS "day",
    "currency",
    "count"(*) AS "payment_count",
    "sum"("gross_amount") AS "gross_revenue",
    "sum"("refunded_amount") AS "refunded",
    "sum"("net_amount") AS "net_revenue",
    "sum"(
        CASE
            WHEN ("purpose" = ANY (ARRAY['unlock_fee'::"text", 'lead_unlock'::"text"])) THEN "net_amount"
            ELSE (0)::numeric
        END) AS "lead_revenue",
    "sum"(
        CASE
            WHEN ("purpose" = 'business_subscription'::"text") THEN "net_amount"
            ELSE (0)::numeric
        END) AS "subscription_revenue"
   FROM "public"."finance_paid_payments_v"
  GROUP BY "paid_day", "currency";


ALTER VIEW "public"."finance_daily_revenue_v" OWNER TO "postgres";


COMMENT ON VIEW "public"."finance_daily_revenue_v" IS 'Sprint 6 Phase 6 — daily revenue rollup by currency.';



CREATE OR REPLACE VIEW "public"."finance_monthly_revenue_v" AS
 SELECT "paid_month" AS "month",
    "currency",
    "count"(*) AS "payment_count",
    "sum"("gross_amount") AS "gross_revenue",
    "sum"("refunded_amount") AS "refunded",
    "sum"("net_amount") AS "net_revenue",
    "sum"(
        CASE
            WHEN ("purpose" = ANY (ARRAY['unlock_fee'::"text", 'lead_unlock'::"text"])) THEN "net_amount"
            ELSE (0)::numeric
        END) AS "lead_revenue",
    "sum"(
        CASE
            WHEN ("purpose" = 'business_subscription'::"text") THEN "net_amount"
            ELSE (0)::numeric
        END) AS "subscription_revenue"
   FROM "public"."finance_paid_payments_v"
  GROUP BY "paid_month", "currency";


ALTER VIEW "public"."finance_monthly_revenue_v" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_number" "text" NOT NULL,
    "document_type" "text" NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'issued'::"text" NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "subtotal" numeric(12,2) DEFAULT 0 NOT NULL,
    "tax_rate" numeric(6,4) DEFAULT 0 NOT NULL,
    "tax_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total" numeric(12,2) DEFAULT 0 NOT NULL,
    "issue_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "payment_date" "date",
    "storage_path" "text",
    "storage_bucket" "text" DEFAULT 'financial-documents'::"text" NOT NULL,
    "content_hash" "text",
    "generated_by" "uuid",
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "regenerated_from" "uuid",
    "immutable" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "financial_documents_document_type_check" CHECK (("document_type" = ANY (ARRAY['business_subscription_invoice'::"text", 'lead_unlock_receipt'::"text", 'manual_payment_receipt'::"text", 'refund_credit_note'::"text"]))),
    CONSTRAINT "financial_documents_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'issued'::"text", 'void'::"text", 'regenerated'::"text"])))
);


ALTER TABLE "public"."financial_documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."financial_documents" IS 'Sprint 6 Phase 4 — immutable financial documents (invoices/receipts).';



CREATE TABLE IF NOT EXISTS "public"."forecast_accuracy" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "history_id" "uuid",
    "model_key" "text",
    "horizon" "text" NOT NULL,
    "predicted_demand" numeric(12,4) NOT NULL,
    "actual_demand" numeric(12,4),
    "absolute_error" numeric(12,4),
    "percent_error" numeric(10,4),
    "evaluated_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."forecast_accuracy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forecast_experiments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "experiment_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "algorithm_a" "text" DEFAULT 'forecast-v1'::"text" NOT NULL,
    "algorithm_b" "text" DEFAULT 'forecast-ml-v0'::"text" NOT NULL,
    "traffic_b_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT false NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forecast_experiments_traffic_b_pct_check" CHECK ((("traffic_b_pct" >= (0)::numeric) AND ("traffic_b_pct" <= (100)::numeric)))
);


ALTER TABLE "public"."forecast_experiments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forecast_explanations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "history_id" "uuid",
    "code" "text" NOT NULL,
    "label_en" "text" NOT NULL,
    "label_ar" "text",
    "audience" "text" DEFAULT 'public'::"text" NOT NULL,
    "params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forecast_explanations_audience_check" CHECK (("audience" = ANY (ARRAY['public'::"text", 'provider'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."forecast_explanations" OWNER TO "postgres";


COMMENT ON TABLE "public"."forecast_explanations" IS 'Public-safe forecast explanations — no internal formula exposure.';



CREATE TABLE IF NOT EXISTS "public"."forecast_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "model_key" "text" DEFAULT 'forecast-v1'::"text" NOT NULL,
    "algorithm_version" "text" DEFAULT 'forecast-v1'::"text" NOT NULL,
    "experiment_id" "text",
    "category_key" "text",
    "region_key" "text" DEFAULT 'all'::"text" NOT NULL,
    "horizon" "text" NOT NULL,
    "expected_demand" numeric(12,4) NOT NULL,
    "confidence" numeric(5,4) DEFAULT 0.5 NOT NULL,
    "trend" "text" DEFAULT 'stable'::"text" NOT NULL,
    "recommended_capacity" numeric(10,2),
    "signal_breakdown" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "latency_ms" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forecast_history_horizon_check" CHECK (("horizon" = ANY (ARRAY['24h'::"text", '7d'::"text", '30d'::"text", '90d'::"text"]))),
    CONSTRAINT "forecast_history_trend_check" CHECK (("trend" = ANY (ARRAY['rising'::"text", 'stable'::"text", 'declining'::"text"])))
);


ALTER TABLE "public"."forecast_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."forecast_history" IS 'Sprint 8 Phase 3 — demand forecasts (advisory only; never guarantees).';



CREATE TABLE IF NOT EXISTS "public"."forecast_market_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_key" "text" NOT NULL,
    "region_key" "text" DEFAULT 'all'::"text" NOT NULL,
    "booking_velocity" numeric(12,4) DEFAULT 0 NOT NULL,
    "demand_index" numeric(8,4) DEFAULT 0.5 NOT NULL,
    "cancellation_rate" numeric(8,4),
    "complaint_rate" numeric(8,4),
    "provider_availability_index" numeric(8,4),
    "pricing_trend_index" numeric(8,4),
    "growing" boolean DEFAULT false NOT NULL,
    "declining" boolean DEFAULT false NOT NULL,
    "sample_count" integer DEFAULT 0 NOT NULL,
    "snapshot_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."forecast_market_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forecast_models" (
    "model_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "algorithm" "text" DEFAULT 'forecast-v1'::"text" NOT NULL,
    "signal_weights" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "ml_ready" boolean DEFAULT false NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."forecast_models" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forecast_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "history_id" "uuid",
    "provider_id" "uuid",
    "category_key" "text",
    "region_key" "text" DEFAULT 'all'::"text" NOT NULL,
    "horizon" "text" NOT NULL,
    "expected_demand" numeric(12,4) NOT NULL,
    "confidence" numeric(5,4) DEFAULT 0.5 NOT NULL,
    "trend" "text" DEFAULT 'stable'::"text" NOT NULL,
    "recommended_capacity" numeric(10,2),
    "busy_periods" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "best_hours" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "revenue_opportunity" numeric(14,2),
    "vacation_windows" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "public_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "cached_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forecast_results_horizon_check" CHECK (("horizon" = ANY (ARRAY['24h'::"text", '7d'::"text", '30d'::"text", '90d'::"text"])))
);


ALTER TABLE "public"."forecast_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forecast_signal_weights" (
    "signal_key" "text" NOT NULL,
    "category" "text" NOT NULL,
    "weight" numeric(8,4) DEFAULT 1.0 NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "ml_ready" boolean DEFAULT false NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forecast_signal_weights_category_check" CHECK (("category" = ANY (ARRAY['history'::"text", 'geo'::"text", 'time'::"text", 'calendar'::"text", 'supply'::"text", 'quality'::"text", 'market'::"text", 'ml'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."forecast_signal_weights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fraud_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "confidence" numeric(5,4) DEFAULT 0.5 NOT NULL,
    "rule_key" "text",
    "title" "text" NOT NULL,
    "summary" "text",
    "related_entity_ids" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source" "text" DEFAULT 'rule'::"text" NOT NULL,
    "investigation_id" "uuid",
    "resolved_at" timestamp with time zone,
    "false_positive" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fraud_events_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['provider'::"text", 'customer'::"text", 'booking'::"text", 'payment'::"text", 'review'::"text", 'case'::"text", 'account'::"text"]))),
    CONSTRAINT "fraud_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['multiple_provider_accounts'::"text", 'multiple_customer_accounts'::"text", 'repeated_failed_payments'::"text", 'abnormal_refund_behaviour'::"text", 'fake_review_network'::"text", 'rating_manipulation'::"text", 'repeated_cancelled_bookings'::"text", 'no_show_patterns'::"text", 'suspicious_messaging'::"text", 'rapid_account_creation'::"text", 'device_anomaly'::"text", 'location_anomaly'::"text", 'repeated_identity_changes'::"text", 'policy_violation'::"text", 'rule_extension'::"text", 'other'::"text"]))),
    CONSTRAINT "fraud_events_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "fraud_events_source_check" CHECK (("source" = ANY (ARRAY['rule'::"text", 'heuristic'::"text", 'ml'::"text", 'manual'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."fraud_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."fraud_events" IS 'Sprint 7 Phase 5 — detected fraud / risk signals (admin-only).';



CREATE TABLE IF NOT EXISTS "public"."images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "bucket" character varying(100) DEFAULT 'provider-media'::character varying NOT NULL,
    "path" "text" NOT NULL,
    "kind" character varying(20) NOT NULL,
    "alt_text" "jsonb",
    "sort_order" smallint DEFAULT 0 NOT NULL,
    "mime_type" character varying(100),
    "size_bytes" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "is_featured" boolean DEFAULT false NOT NULL,
    CONSTRAINT "images_kind_check" CHECK ((("kind")::"text" = ANY ((ARRAY['avatar'::character varying, 'cover'::character varying, 'gallery'::character varying])::"text"[])))
);


ALTER TABLE "public"."images" OWNER TO "postgres";


COMMENT ON COLUMN "public"."images"."is_featured" IS 'When true, gallery image is the featured work photo for the provider.';



CREATE TABLE IF NOT EXISTS "public"."investigation_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "investigation_id" "uuid" NOT NULL,
    "from_status" "text",
    "to_status" "text",
    "action" "text" NOT NULL,
    "actor_id" "uuid",
    "note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."investigation_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."investigation_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "investigation_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "visibility" "text" DEFAULT 'internal'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "investigation_notes_visibility_check" CHECK (("visibility" = 'internal'::"text"))
);


ALTER TABLE "public"."investigation_notes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."investigation_number_seq"
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."investigation_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."investigations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_number" "text" NOT NULL,
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "primary_entity_type" "text" NOT NULL,
    "primary_entity_id" "text" NOT NULL,
    "related_entity_ids" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "assigned_admin_id" "uuid",
    "outcome" "text",
    "merged_into_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "investigations_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "investigations_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'awaiting_info'::"text", 'escalated'::"text", 'resolved'::"text", 'closed'::"text", 'false_positive'::"text"])))
);


ALTER TABLE "public"."investigations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_metadata" (
    "document_id" "uuid" NOT NULL,
    "provider_name" "text",
    "provider_company" "text",
    "subscription_plan" "text",
    "billing_period_start" "date",
    "billing_period_end" "date",
    "payment_reference" "text",
    "stripe_reference" "text",
    "payment_status" "text",
    "line_description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invoice_metadata" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "payment_id" "uuid",
    "invoice_number" character varying(40) NOT NULL,
    "subtotal" numeric(10,2) NOT NULL,
    "total" numeric(10,2) NOT NULL,
    "currency" character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    "status" "public"."invoice_status" DEFAULT 'issued'::"public"."invoice_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_pricing_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unlock_session_id" "uuid",
    "service_request_id" "uuid",
    "provider_id" "uuid",
    "ai_score" numeric(8,4) DEFAULT 0 NOT NULL,
    "base_price_usd" numeric(10,2) NOT NULL,
    "final_price_usd" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "factors" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "explanation_en" "text" DEFAULT ''::"text" NOT NULL,
    "explanation_ar" "text" DEFAULT ''::"text" NOT NULL,
    "estimated_project_value_usd" numeric(12,2),
    "estimated_duration_hours" numeric(8,2),
    "potential_revenue_usd" numeric(12,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_pricing_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."lead_pricing_history" IS 'Sprint 6 Phase 1 — AI unlock price snapshots with explanations.';



CREATE TABLE IF NOT EXISTS "public"."lead_unlock_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "unlock_session_id" "uuid" NOT NULL,
    "service_request_id" "uuid",
    "provider_id" "uuid" NOT NULL,
    "ai_price_usd" numeric(10,2),
    "ai_score" numeric(8,4),
    "pricing_history_id" "uuid",
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "unlock_granted" boolean DEFAULT false NOT NULL,
    "unlocked_at" timestamp with time zone,
    "payment_reference" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_unlock_payments" OWNER TO "postgres";


COMMENT ON TABLE "public"."lead_unlock_payments" IS 'Sprint 6 Phase 2 — lead unlock payment correlation (AI price + grant).';



CREATE TABLE IF NOT EXISTS "public"."learning_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" character varying(64) NOT NULL,
    "provider_id" "uuid",
    "customer_id" "uuid",
    "service_request_id" "uuid",
    "search_log_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "learning_events_type_chk" CHECK ((("event_type")::"text" = ANY ((ARRAY['provider_viewed'::character varying, 'provider_clicked'::character varying, 'request_started'::character varying, 'request_sent'::character varying, 'request_accepted'::character varying, 'request_declined'::character varying, 'provider_no_response'::character varying, 'request_completed'::character varying, 'customer_cancelled'::character varying, 'provider_cancelled'::character varying, 'review_submitted'::character varying, 'repeat_booking'::character varying, 'recommendation_shown'::character varying, 'recommendation_chosen'::character varying, 'diagnosis_completed'::character varying, 'diagnosis_abandoned'::character varying, 'intent_suggested'::character varying, 'intent_confirmed'::character varying, 'intent_corrected'::character varying, 'category_changed'::character varying, 'knowledge_hit'::character varying, 'knowledge_miss'::character varying, 'llm_invoked'::character varying, 'provider_accepted'::character varying, 'provider_declined'::character varying, 'job_completed'::character varying, 'memory_recorded'::character varying, 'urgency_corrected'::character varying, 'workflow_recommended'::character varying, 'workflow_overridden'::character varying, 'match_ranked'::character varying, 'match_accepted'::character varying, 'match_rejected'::character varying, 'question_answered'::character varying, 'intent_cached'::character varying, 'dispatch_planned'::character varying, 'dispatch_exposed'::character varying, 'capacity_skipped'::character varying, 'route_boosted'::character varying, 'response_predicted'::character varying, 'eta_predicted'::character varying, 'prediction_compared'::character varying, 'reputation_updated'::character varying, 'job_analyzed'::character varying, 'job_prep_shown'::character varying, 'job_duration_compared'::character varying, 'job_materials_compared'::character varying, 'job_complexity_compared'::character varying, 'multi_service_detected'::character varying, 'vision_analyzed'::character varying, 'vision_cached'::character varying, 'vision_confirmed'::character varying, 'vision_corrected'::character varying, 'vision_fused'::character varying, 'vision_contradiction'::character varying, 'vision_damage_compared'::character varying, 'vision_tools_compared'::character varying, 'vision_materials_compared'::character varying, 'voice_transcribed'::character varying, 'voice_cached'::character varying, 'voice_confirmed'::character varying, 'voice_corrected'::character varying, 'voice_transcript_edited'::character varying, 'voice_fused'::character varying, 'voice_contradiction'::character varying, 'voice_language_detected'::character varying, 'voice_stt_failed'::character varying, 'voice_category_compared'::character varying, 'assistant_shown'::character varying, 'assistant_suggestion_accepted'::character varying, 'assistant_suggestion_ignored'::character varying, 'assistant_suggestion_rejected'::character varying, 'assistant_summary_generated'::character varying, 'assistant_summary_rated'::character varying, 'assistant_offer_compared'::character varying, 'assistant_appointment_briefed'::character varying, 'assistant_after_job'::character varying, 'assistant_reminder_sent'::character varying, 'assistant_reminder_acted'::character varying, 'assistant_context_updated'::character varying, 'forecast_correct'::character varying, 'forecast_incorrect'::character varying, 'capacity_prediction'::character varying, 'demand_prediction'::character varying, 'wait_time_prediction'::character varying, 'notification_clicked'::character varying, 'recommendation_followed'::character varying, 'balance_action_recommended'::character varying, 'prediction_calibrated'::character varying, 'automation_suggested'::character varying, 'automation_executed'::character varying, 'automation_confirmed'::character varying, 'automation_rejected'::character varying, 'automation_modified'::character varying, 'automation_reversed'::character varying, 'automation_blocked_safety'::character varying, 'workflow_run'::character varying, 'marketplace_mode_chosen'::character varying, 'ai_path_recommendation_accepted'::character varying, 'ai_path_recommendation_ignored'::character varying, 'provider_contacted_directly'::character varying, 'request_published'::character varying, 'dual_path_switched'::character varying, 'slot_suggested'::character varying, 'slot_suggestion_accepted'::character varying, 'slot_suggestion_rejected'::character varying, 'appointment_cancelled'::character varying, 'appointment_delayed'::character varying, 'appointment_duration_compared'::character varying, 'appointment_arrival_compared'::character varying, 'day_schedule_optimized'::character varying, 'reschedule_suggested'::character varying, 'reschedule_accepted'::character varying, 'reschedule_rejected'::character varying, 'booking_reminder_sent'::character varying, 'emergency_detected'::character varying, 'emergency_dispatch_started'::character varying, 'emergency_provider_notified'::character varying, 'emergency_accepted'::character varying, 'emergency_declined'::character varying, 'emergency_busy'::character varying, 'emergency_on_the_way'::character varying, 'emergency_arrived'::character varying, 'emergency_work_started'::character varying, 'emergency_completed'::character varying, 'emergency_dispatch_stopped'::character varying, 'live_eta_updated'::character varying, 'live_location_shared'::character varying, 'live_location_disabled'::character varying, 'project_detected'::character varying, 'project_created'::character varying, 'project_plan_generated'::character varying, 'project_plan_reordered'::character varying, 'project_package_matched'::character varying, 'project_package_booked'::character varying, 'project_package_started'::character varying, 'project_package_completed'::character varying, 'project_dependency_blocked'::character varying, 'project_delay_detected'::character varying, 'project_schedule_adjusted'::character varying, 'project_completed'::character varying, 'project_duration_compared'::character varying, 'recurring_plan_created'::character varying, 'recurring_plan_renewed'::character varying, 'recurring_plan_paused'::character varying, 'recurring_plan_resumed'::character varying, 'recurring_plan_cancelled'::character varying, 'recurring_visit_skipped'::character varying, 'recurring_visit_rescheduled'::character varying, 'recurring_visit_completed'::character varying, 'recurring_visit_generated'::character varying, 'recurring_recommendation_shown'::character varying, 'recurring_recommendation_accepted'::character varying, 'recurring_recommendation_rejected'::character varying, 'recurring_reminder_sent'::character varying, 'recurring_route_optimized'::character varying, 'maintenance_due_detected'::character varying, 'chat_message_sent'::character varying, 'chat_message_edited'::character varying, 'chat_message_deleted'::character varying, 'chat_reply_sent'::character varying, 'chat_message_pinned'::character varying, 'chat_message_unpinned'::character varying, 'chat_read'::character varying, 'chat_mark_all_read'::character varying, 'chat_search'::character varying, 'chat_typing'::character varying, 'chat_presence'::character varying, 'chat_reply_latency'::character varying, 'chat_read_latency'::character varying, 'chat_conversation_opened'::character varying, 'chat_emergency_response'::character varying, 'media_file_uploaded'::character varying, 'media_file_viewed'::character varying, 'media_file_downloaded'::character varying, 'media_preview_opened'::character varying, 'media_voice_played'::character varying, 'media_gallery_viewed'::character varying, 'media_project_shared'::character varying, 'media_file_renamed'::character varying, 'media_file_deleted'::character varying, 'media_file_restored'::character varying, 'media_file_replaced'::character varying, 'media_file_pinned'::character varying, 'media_processing_queued'::character varying, 'media_processing_completed'::character varying, 'chat_ai_summary_generated'::character varying, 'chat_ai_reply_suggested'::character varying, 'chat_ai_reply_accepted'::character varying, 'chat_ai_reply_edited'::character varying, 'chat_ai_translation_used'::character varying, 'chat_ai_extraction_created'::character varying, 'chat_ai_extraction_corrected'::character varying, 'chat_ai_task_detected'::character varying, 'chat_ai_task_completed'::character varying, 'chat_ai_sentiment_scored'::character varying, 'chat_ai_panel_opened'::character varying, 'chat_ai_disabled'::character varying, 'chat_ai_enabled'::character varying, 'chat_ai_summary_deleted'::character varying, 'chat_voice_recorded'::character varying, 'chat_voice_played'::character varying, 'chat_voice_transcript_generated'::character varying, 'chat_voice_transcript_deleted'::character varying, 'chat_voice_summary_generated'::character varying, 'chat_voice_translation_used'::character varying, 'chat_voice_transcript_searched'::character varying, 'chat_voice_consent_granted'::character varying, 'chat_voice_consent_revoked'::character varying, 'collab_workspace_opened'::character varying, 'collab_task_created'::character varying, 'collab_task_updated'::character varying, 'collab_task_completed'::character varying, 'collab_checklist_created'::character varying, 'collab_checklist_item_toggled'::character varying, 'collab_checklist_completed'::character varying, 'collab_approval_requested'::character varying, 'collab_approval_accepted'::character varying, 'collab_approval_rejected'::character varying, 'collab_document_versioned'::character varying, 'collab_activity_logged'::character varying, 'collab_ai_summary_generated'::character varying, 'collab_ai_recommendation_accepted'::character varying, 'collab_ai_recommendation_ignored'::character varying, 'notif_center_opened'::character varying, 'notif_opened'::character varying, 'notif_dismissed'::character varying, 'notif_archived'::character varying, 'notif_deleted'::character varying, 'notif_action_completed'::character varying, 'notif_marked_read'::character varying, 'notif_marked_unread'::character varying, 'notif_digest_opened'::character varying, 'notif_digest_generated'::character varying, 'notif_preference_changed'::character varying, 'notif_grouped'::character varying, 'notif_group_opened'::character varying, 'notif_priority_boost_suggested'::character varying, 'notif_channel_delivered'::character varying, 'notif_channel_skipped'::character varying, 'lead_price_calculated'::character varying, 'lead_unlock_started'::character varying, 'lead_unlock_included'::character varying, 'lead_unlock_paid'::character varying, 'lead_unlock_granted'::character varying, 'business_plan_upgraded'::character varying, 'business_plan_cancelled'::character varying, 'included_unlock_consumed'::character varying, 'included_unlocks_reset'::character varying, 'monetization_settings_changed'::character varying, 'payment_created'::character varying, 'payment_succeeded'::character varying, 'payment_failed'::character varying, 'payment_cancelled'::character varying, 'payment_expired'::character varying, 'subscription_payment_started'::character varying, 'subscription_payment_activated'::character varying, 'subscription_renewed'::character varying, 'subscription_cancelled'::character varying, 'lead_payment_recorded'::character varying, 'payment_history_viewed'::character varying, 'payment_receipt_downloaded'::character varying, 'invoice_generated'::character varying, 'receipt_generated'::character varying, 'pdf_downloaded'::character varying, 'pdf_regenerated'::character varying, 'pdf_generation_failed'::character varying, 'document_accessed'::character varying, 'credit_note_generated'::character varying, 'refund_requested'::character varying, 'refund_approved'::character varying, 'refund_rejected'::character varying, 'refund_completed'::character varying, 'refund_failed'::character varying, 'dispute_opened'::character varying, 'dispute_updated'::character varying, 'dispute_closed'::character varying, 'dispute_evidence_uploaded'::character varying, 'refund_webhook_error'::character varying, 'finance_dashboard_viewed'::character varying, 'finance_report_exported'::character varying, 'finance_cache_refreshed'::character varying])::"text"[])))
);


ALTER TABLE "public"."learning_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."learning_events" IS 'Append-only anonymous learning signals for Dalily AI. Never rewrite; never store exact GPS.';



CREATE TABLE IF NOT EXISTS "public"."maintenance_contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "provider_id" "uuid",
    "contract_start" "date" NOT NULL,
    "contract_end" "date",
    "auto_renew" boolean DEFAULT true NOT NULL,
    "preferred_weekdays" integer[] DEFAULT '{}'::integer[] NOT NULL,
    "preferred_time_start" time without time zone,
    "preferred_time_end" time without time zone,
    "emergency_contact" "text",
    "terms_notes" "text",
    "renewal_notice_days" integer DEFAULT 14 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."maintenance_contracts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_algorithm_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "module_key" "text" NOT NULL,
    "algorithm_version" "text" NOT NULL,
    "engine_kind" "text" DEFAULT 'rule'::"text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketplace_algorithm_versions_engine_kind_check" CHECK (("engine_kind" = ANY (ARRAY['rule'::"text", 'ml'::"text", 'predictive'::"text", 'simulation'::"text", 'agent'::"text"])))
);


ALTER TABLE "public"."marketplace_algorithm_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_category_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_key" "text" NOT NULL,
    "growth" numeric(8,4),
    "demand" numeric(8,4),
    "provider_density" numeric(8,4),
    "competition" numeric(8,4),
    "average_pricing" numeric(14,2),
    "completion_rate" numeric(8,4),
    "quality" numeric(8,4),
    "trust" numeric(8,4),
    "profitability" numeric(8,4),
    "seasonality" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "peak_hours" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "forecast" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "opportunity_score" numeric(8,4),
    "risk_score" numeric(8,4),
    "summary_en" "text",
    "summary_ar" "text",
    "algorithm_version" "text" DEFAULT 'market-intel-v1'::"text" NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketplace_category_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recommendation_id" "uuid",
    "title_en" "text" NOT NULL,
    "title_ar" "text",
    "reason_en" "text",
    "expected_impact" "text",
    "confidence" numeric(8,4),
    "required_effort" "text",
    "estimated_roi" numeric(8,4),
    "estimated_time" "text",
    "dependencies" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'proposed'::"text" NOT NULL,
    "audit_log" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "decided_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "decided_at" timestamp with time zone,
    CONSTRAINT "marketplace_decisions_status_check" CHECK (("status" = ANY (ARRAY['proposed'::"text", 'approved'::"text", 'rejected'::"text", 'deferred'::"text"])))
);


ALTER TABLE "public"."marketplace_decisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_executive_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_id" "uuid",
    "title" "text" NOT NULL,
    "executive_summary_en" "text" NOT NULL,
    "executive_summary_ar" "text",
    "sections" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "restricted" boolean DEFAULT true NOT NULL,
    "algorithm_version" "text" DEFAULT 'market-intel-v1'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketplace_executive_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."marketplace_executive_reports" IS 'Restricted executive dashboards — admin role required.';



CREATE TABLE IF NOT EXISTS "public"."marketplace_heatmaps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "region_key" "text" NOT NULL,
    "metric_key" "text" DEFAULT 'demand'::"text" NOT NULL,
    "cells" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "algorithm_version" "text" DEFAULT 'market-intel-v1'::"text" NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketplace_heatmaps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_intelligence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "snapshot_key" "text" DEFAULT 'global'::"text" NOT NULL,
    "metrics" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "growth_index" numeric(8,4),
    "liquidity_index" numeric(8,4),
    "health_score" numeric(8,4),
    "demand_index" numeric(8,4),
    "supply_index" numeric(8,4),
    "algorithm_version" "text" DEFAULT 'market-intel-v1'::"text" NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketplace_intelligence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_knowledge_graph" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "node_type" "text" NOT NULL,
    "node_key" "text" NOT NULL,
    "label" "text",
    "properties" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "edges" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "internal_only" boolean DEFAULT true NOT NULL,
    "algorithm_version" "text" DEFAULT 'market-kg-v1'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketplace_knowledge_graph_node_type_check" CHECK (("node_type" = ANY (ARRAY['provider'::"text", 'customer'::"text", 'booking'::"text", 'category'::"text", 'region'::"text", 'payment'::"text", 'review'::"text", 'quality_case'::"text", 'fraud_investigation'::"text", 'trust'::"text", 'forecast'::"text", 'pricing'::"text", 'scheduling'::"text", 'business_metric'::"text", 'marketplace_event'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."marketplace_knowledge_graph" OWNER TO "postgres";


COMMENT ON TABLE "public"."marketplace_knowledge_graph" IS 'Internal AI knowledge graph — admin/internal only.';



CREATE TABLE IF NOT EXISTS "public"."marketplace_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" character varying(60) NOT NULL,
    "title_key" character varying(120) NOT NULL,
    "body_key" character varying(120) NOT NULL,
    "body_params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "href" "text",
    "service_request_id" "uuid",
    "conversation_id" "uuid",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketplace_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_request_id" "uuid" NOT NULL,
    "match_assignment_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "price" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'SYP'::"text" NOT NULL,
    "price_model" "text" DEFAULT 'fixed'::"text" NOT NULL,
    "inclusions" "text",
    "eta_text" "text",
    "message" "text",
    "expires_at" timestamp with time zone,
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "quality_flags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "template_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketplace_offers_price_check" CHECK (("price" > (0)::numeric)),
    CONSTRAINT "marketplace_offers_price_model_check" CHECK (("price_model" = ANY (ARRAY['fixed'::"text", 'hourly'::"text", 'estimate'::"text"]))),
    CONSTRAINT "marketplace_offers_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'withdrawn'::"text", 'selected'::"text", 'superseded'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."marketplace_offers" OWNER TO "postgres";


COMMENT ON TABLE "public"."marketplace_offers" IS 'Dalily 2.0 Offer Service — competing offers rooted in match_assignments (Sprint 4).';



CREATE TABLE IF NOT EXISTS "public"."marketplace_opportunities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "kind" "text" DEFAULT 'general'::"text" NOT NULL,
    "title_en" "text" NOT NULL,
    "title_ar" "text",
    "body_en" "text",
    "body_ar" "text",
    "region_key" "text",
    "category_key" "text",
    "score" numeric(8,4) DEFAULT 0.5 NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "algorithm_version" "text" DEFAULT 'market-intel-v1'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "decided_at" timestamp with time zone,
    "decided_by" "uuid",
    CONSTRAINT "marketplace_opportunities_kind_check" CHECK (("kind" = ANY (ARRAY['growing_category'::"text", 'underserved_region'::"text", 'high_demand_neighborhood'::"text", 'provider_shortage'::"text", 'premium'::"text", 'partnership'::"text", 'enterprise'::"text", 'recurring'::"text", 'cross_category'::"text", 'expansion'::"text", 'general'::"text"]))),
    CONSTRAINT "marketplace_opportunities_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'accepted'::"text", 'dismissed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."marketplace_opportunities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_recommendations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "audience" "text" DEFAULT 'admin'::"text" NOT NULL,
    "subject_id" "uuid",
    "code" "text" NOT NULL,
    "title_en" "text" NOT NULL,
    "title_ar" "text",
    "reason_en" "text",
    "reason_ar" "text",
    "expected_impact" "text",
    "confidence" numeric(8,4) DEFAULT 0.5 NOT NULL,
    "required_effort" "text",
    "estimated_roi" numeric(8,4),
    "estimated_time" "text",
    "dependencies" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "algorithm_version" "text" DEFAULT 'market-intel-v1'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "decided_at" timestamp with time zone,
    "decided_by" "uuid",
    "audit_log" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "marketplace_recommendations_audience_check" CHECK (("audience" = ANY (ARRAY['admin'::"text", 'provider'::"text", 'customer'::"text", 'executive'::"text"]))),
    CONSTRAINT "marketplace_recommendations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'dismissed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."marketplace_recommendations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_region_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "region_key" "text" NOT NULL,
    "demand" numeric(8,4),
    "supply" numeric(8,4),
    "competition" numeric(8,4),
    "growth" numeric(8,4),
    "provider_density" numeric(8,4),
    "avg_response_min" numeric(10,2),
    "avg_travel_km" numeric(10,2),
    "average_pricing" numeric(14,2),
    "customer_satisfaction" numeric(8,4),
    "complaint_rate" numeric(8,4),
    "forecast" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "opportunity_score" numeric(8,4),
    "expansion_potential" numeric(8,4),
    "heatmap" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "summary_en" "text",
    "summary_ar" "text",
    "algorithm_version" "text" DEFAULT 'market-intel-v1'::"text" NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketplace_region_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_type" "text" NOT NULL,
    "period_start" "date",
    "period_end" "date",
    "summary_en" "text" NOT NULL,
    "summary_ar" "text",
    "key_changes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "risks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "opportunities" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "predictions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "recommended_actions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "confidence" numeric(8,4),
    "trend_direction" "text",
    "algorithm_version" "text" DEFAULT 'market-intel-v1'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketplace_reports_report_type_check" CHECK (("report_type" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text", 'quarterly'::"text", 'yearly'::"text", 'ad_hoc'::"text"]))),
    CONSTRAINT "marketplace_reports_trend_direction_check" CHECK (("trend_direction" = ANY (ARRAY['rising'::"text", 'stable'::"text", 'declining'::"text"])))
);


ALTER TABLE "public"."marketplace_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_request_projections" (
    "service_request_id" "uuid" NOT NULL,
    "lifecycle_phase" "text" NOT NULL,
    "legacy_status" "text" NOT NULL,
    "selection_id" "uuid",
    "lifecycle_version" smallint DEFAULT 1 NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketplace_request_projections" OWNER TO "postgres";


COMMENT ON TABLE "public"."marketplace_request_projections" IS 'Dalily 2.0 Marketplace projection synced when MARKETPLACE_DOMAIN_V2 is on. Not authoritative for money/PII.';



CREATE TABLE IF NOT EXISTS "public"."marketplace_selections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_request_id" "uuid" NOT NULL,
    "provider_id" "uuid",
    "offer_id" "uuid",
    "status" "text" DEFAULT 'pending_unlock'::"text" NOT NULL,
    "selected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketplace_selections_status_check" CHECK (("status" = ANY (ARRAY['pending_unlock'::"text", 'unlocked'::"text", 'declined'::"text", 'timed_out'::"text", 'superseded'::"text"])))
);


ALTER TABLE "public"."marketplace_selections" OWNER TO "postgres";


COMMENT ON TABLE "public"."marketplace_selections" IS 'Dalily 2.0 Marketplace selection placeholder. Unused by product UI until Sprint 4/5.';



CREATE TABLE IF NOT EXISTS "public"."marketplace_simulations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "scenario_type" "text" DEFAULT 'custom'::"text" NOT NULL,
    "inputs" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "results" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "impact_summary_en" "text",
    "impact_summary_ar" "text",
    "affects_production" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "algorithm_version" "text" DEFAULT 'market-sim-v1'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "marketplace_simulations_no_prod" CHECK (("affects_production" = false)),
    CONSTRAINT "marketplace_simulations_scenario_type_check" CHECK (("scenario_type" = ANY (ARRAY['provider_count'::"text", 'response_time'::"text", 'pricing_weights'::"text", 'matching_algorithm'::"text", 'reputation_weights'::"text", 'new_category'::"text", 'new_city'::"text", 'custom'::"text"]))),
    CONSTRAINT "marketplace_simulations_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."marketplace_simulations" OWNER TO "postgres";


COMMENT ON TABLE "public"."marketplace_simulations" IS 'Digital twin — isolated; affects_production must remain false.';



CREATE TABLE IF NOT EXISTS "public"."match_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pool_id" "uuid" NOT NULL,
    "service_request_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "reason_codes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "rank_in_pool" integer DEFAULT 0 NOT NULL,
    "source" "text" DEFAULT 'initial'::"text" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ai_match_score" numeric(5,2),
    "ai_explanation" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "exposure_mode" character varying(32),
    "response_band" character varying(16),
    "response_probability" numeric(6,4),
    "eta_label" "text",
    "operational_score" numeric(5,2),
    "reputation_score" numeric(5,2),
    CONSTRAINT "match_assignments_ai_match_score_check" CHECK ((("ai_match_score" IS NULL) OR (("ai_match_score" >= (0)::numeric) AND ("ai_match_score" <= (100)::numeric)))),
    CONSTRAINT "match_assignments_source_check" CHECK (("source" = ANY (ARRAY['initial'::"text", 'expand'::"text", 'newcomer'::"text"])))
);


ALTER TABLE "public"."match_assignments" OWNER TO "postgres";


COMMENT ON TABLE "public"."match_assignments" IS 'Dalily 2.0 scarce provider assignments with reason_codes. No subscription influence.';



COMMENT ON COLUMN "public"."match_assignments"."ai_match_score" IS 'AI Engine Phase 2 overall match score 0–100. Null when AI ranking off.';



COMMENT ON COLUMN "public"."match_assignments"."ai_explanation" IS 'Human-readable explanation bullets for why this provider was ranked.';



COMMENT ON COLUMN "public"."match_assignments"."exposure_mode" IS 'Phase 3 marketplace exposure mode for this assignment.';



COMMENT ON COLUMN "public"."match_assignments"."operational_score" IS 'Phase 3 combined operational dispatch score 0–100.';



CREATE TABLE IF NOT EXISTS "public"."match_pools" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_request_id" "uuid" NOT NULL,
    "cell_key" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "expand_count" integer DEFAULT 0 NOT NULL,
    "initial_candidate_count" integer DEFAULT 0 NOT NULL,
    "assigned_count" integer DEFAULT 0 NOT NULL,
    "policy_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "match_pools_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'expanded'::"text", 'closed'::"text", 'insufficient_supply'::"text"])))
);


ALTER TABLE "public"."match_pools" OWNER TO "postgres";


COMMENT ON TABLE "public"."match_pools" IS 'Dalily 2.0 Matching Service — one pool per marketplace request (Sprint 3).';



CREATE TABLE IF NOT EXISTS "public"."matching_experiments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "experiment_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "algorithm_a" "text" DEFAULT 'smart-match-v1'::"text" NOT NULL,
    "algorithm_b" "text" DEFAULT 'smart-match-ml-v0'::"text" NOT NULL,
    "traffic_b_pct" numeric(5,2) DEFAULT 10 NOT NULL,
    "active" boolean DEFAULT false NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "matching_experiments_traffic_b_pct_check" CHECK ((("traffic_b_pct" >= (0)::numeric) AND ("traffic_b_pct" <= (100)::numeric)))
);


ALTER TABLE "public"."matching_experiments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matching_explanations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "score_id" "uuid",
    "request_id" "text",
    "provider_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "label_en" "text" NOT NULL,
    "label_ar" "text",
    "params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."matching_explanations" OWNER TO "postgres";


COMMENT ON TABLE "public"."matching_explanations" IS 'Public-safe explanation bullets only — no numeric scores.';



CREATE TABLE IF NOT EXISTS "public"."matching_fairness_state" (
    "provider_id" "uuid" NOT NULL,
    "exploration_boost" numeric(8,4) DEFAULT 0 NOT NULL,
    "cold_start_boost" numeric(8,4) DEFAULT 0 NOT NULL,
    "rotation_token" numeric(8,4) DEFAULT 0 NOT NULL,
    "boost_expires_at" timestamp with time zone,
    "impressions" integer DEFAULT 0 NOT NULL,
    "selections" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."matching_fairness_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matching_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "text",
    "booking_id" "uuid",
    "customer_id" "uuid",
    "provider_id" "uuid" NOT NULL,
    "recommended" boolean DEFAULT false NOT NULL,
    "accepted" boolean,
    "completed" boolean,
    "rating" numeric(3,1),
    "complaint" boolean DEFAULT false NOT NULL,
    "repeat_booking" boolean DEFAULT false NOT NULL,
    "algorithm_version" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."matching_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matching_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "text",
    "customer_id" "uuid",
    "provider_ids" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "scores" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "algorithm_version" "text" NOT NULL,
    "experiment_id" "text",
    "latency_ms" integer,
    "source" "text" DEFAULT 'marketplace'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "matching_history_source_check" CHECK (("source" = ANY (ARRAY['marketplace'::"text", 'search'::"text", 'simulation'::"text", 'replay'::"text"])))
);


ALTER TABLE "public"."matching_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matching_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "text",
    "customer_id" "uuid",
    "provider_id" "uuid" NOT NULL,
    "internal_score" numeric(8,4) NOT NULL,
    "signal_breakdown" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "fairness_boost" numeric(8,4) DEFAULT 0 NOT NULL,
    "ml_contribution" numeric(8,4) DEFAULT 0 NOT NULL,
    "algorithm_version" "text" DEFAULT 'smart-match-v1'::"text" NOT NULL,
    "experiment_id" "text",
    "latency_ms" integer,
    "rank" integer,
    "cached_until" timestamp with time zone,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."matching_scores" OWNER TO "postgres";


COMMENT ON TABLE "public"."matching_scores" IS 'Sprint 8 Phase 1 — internal match scores (never public).';



CREATE TABLE IF NOT EXISTS "public"."matching_weights" (
    "signal_key" "text" NOT NULL,
    "category" "text" NOT NULL,
    "weight" numeric(8,4) DEFAULT 1.0 NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "ml_ready" boolean DEFAULT false NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "matching_weights_category_check" CHECK (("category" = ANY (ARRAY['geo'::"text", 'availability'::"text", 'reputation'::"text", 'quality'::"text", 'behaviour'::"text", 'identity'::"text", 'preference'::"text", 'price'::"text", 'fairness'::"text", 'risk'::"text", 'ml'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."matching_weights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_objects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "bucket" "text" NOT NULL,
    "path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "display_name" "text",
    "mime_type" "text" NOT NULL,
    "size_bytes" bigint DEFAULT 0 NOT NULL,
    "kind" "text" DEFAULT 'other'::"text" NOT NULL,
    "width" integer,
    "height" integer,
    "duration_ms" integer,
    "thumbnail_path" "text",
    "conversation_id" "uuid",
    "project_id" "uuid",
    "package_id" "uuid",
    "message_attachment_id" "uuid",
    "project_document_id" "uuid",
    "processing_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "ocr_ready" boolean DEFAULT false NOT NULL,
    "analysis_ready" boolean DEFAULT false NOT NULL,
    "transcription_ready" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "deleted_at" timestamp with time zone,
    "restore_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "transcription_text" "text",
    "transcription_language" "text",
    CONSTRAINT "media_objects_kind_check" CHECK (("kind" = ANY (ARRAY['image'::"text", 'document'::"text", 'voice'::"text", 'video'::"text", 'other'::"text", 'audio'::"text"]))),
    CONSTRAINT "media_objects_processing_status_check" CHECK (("processing_status" = ANY (ARRAY['pending'::"text", 'queued'::"text", 'processing'::"text", 'ready'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."media_objects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_processing_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "media_object_id" "uuid" NOT NULL,
    "job_type" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "result" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    CONSTRAINT "media_processing_jobs_job_type_check" CHECK (("job_type" = ANY (ARRAY['thumbnail'::"text", 'metadata'::"text", 'ocr_prep'::"text", 'image_analysis'::"text", 'transcription'::"text", 'waveform'::"text"]))),
    CONSTRAINT "media_processing_jobs_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."media_processing_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "uploader_id" "uuid" NOT NULL,
    "bucket" "text" DEFAULT 'chat-attachments'::"text" NOT NULL,
    "path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "size_bytes" bigint DEFAULT 0 NOT NULL,
    "width" integer,
    "height" integer,
    "kind" "text" DEFAULT 'document'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "display_name" "text",
    "is_pinned" boolean DEFAULT false NOT NULL,
    "pinned_at" timestamp with time zone,
    "pinned_by" "uuid",
    "duration_ms" integer,
    "thumbnail_path" "text",
    "processing_status" "text" DEFAULT 'ready'::"text" NOT NULL,
    "ocr_ready" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "restore_until" timestamp with time zone,
    "replaced_attachment_id" "uuid",
    "forwarded_from_attachment_id" "uuid",
    "media_object_id" "uuid",
    "waveform_peaks" "jsonb",
    "transcript_id" "uuid",
    CONSTRAINT "message_attachments_kind_check" CHECK (("kind" = ANY (ARRAY['image'::"text", 'document'::"text", 'voice'::"text", 'video'::"text", 'other'::"text"]))),
    CONSTRAINT "message_attachments_processing_status_check" CHECK (("processing_status" = ANY (ARRAY['pending'::"text", 'queued'::"text", 'processing'::"text", 'ready'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."message_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_read_receipts" (
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'delivered'::"text" NOT NULL,
    "delivered_at" timestamp with time zone,
    "read_at" timestamp with time zone,
    CONSTRAINT "message_read_receipts_status_check" CHECK (("status" = ANY (ARRAY['delivered'::"text", 'read'::"text"])))
);


ALTER TABLE "public"."message_read_receipts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "body_text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_system" boolean DEFAULT false NOT NULL,
    "event_type" character varying(40),
    "message_type" "text" DEFAULT 'text'::"text" NOT NULL,
    "delivery_status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "edited_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "client_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "location_lat" double precision,
    "location_lng" double precision,
    "location_label" "text",
    "reply_to_message_id" "uuid",
    "is_pinned" boolean DEFAULT false NOT NULL,
    "pinned_at" timestamp with time zone,
    "pinned_by" "uuid",
    "forwarded_from_message_id" "uuid",
    CONSTRAINT "messages_body_or_rich_content" CHECK ((("length"(TRIM(BOTH FROM COALESCE("body_text", ''::"text"))) > 0) OR ("message_type" = ANY (ARRAY['image'::"text", 'document'::"text", 'location'::"text", 'voice'::"text", 'video'::"text", 'system'::"text"])) OR ("deleted_at" IS NOT NULL))),
    CONSTRAINT "messages_delivery_status_check" CHECK (("delivery_status" = ANY (ARRAY['sent'::"text", 'delivered'::"text", 'read'::"text"]))),
    CONSTRAINT "messages_message_type_check" CHECK (("message_type" = ANY (ARRAY['text'::"text", 'image'::"text", 'document'::"text", 'location'::"text", 'voice'::"text", 'system'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."modules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" character varying(50) NOT NULL,
    "name" "jsonb" NOT NULL,
    "description" "jsonb",
    "icon" character varying(50),
    "is_active" boolean DEFAULT false NOT NULL,
    "sort_order" smallint DEFAULT 0 NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."modules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."monetization_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid",
    "provider_id" "uuid",
    "event_key" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."monetization_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."monetization_billing_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_price_usd" numeric(10,2) DEFAULT 20.00 NOT NULL,
    "included_unlocks" integer DEFAULT 10 NOT NULL,
    "min_lead_price_usd" numeric(10,2) DEFAULT 2.00 NOT NULL,
    "max_lead_price_usd" numeric(10,2) DEFAULT 20.00 NOT NULL,
    "base_lead_price_usd" numeric(10,2) DEFAULT 5.00 NOT NULL,
    "emergency_multiplier" numeric(6,3) DEFAULT 1.500 NOT NULL,
    "urgency_multiplier" numeric(6,3) DEFAULT 1.250 NOT NULL,
    "multi_service_multiplier" numeric(6,3) DEFAULT 1.350 NOT NULL,
    "complexity_multiplier" numeric(6,3) DEFAULT 1.200 NOT NULL,
    "distance_multiplier_per_km" numeric(6,4) DEFAULT 0.0200 NOT NULL,
    "demand_multiplier" numeric(6,3) DEFAULT 1.100 NOT NULL,
    "category_multipliers" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "monetization_billing_settings_check" CHECK (("max_lead_price_usd" >= "min_lead_price_usd")),
    CONSTRAINT "monetization_billing_settings_included_unlocks_check" CHECK (("included_unlocks" >= 0)),
    CONSTRAINT "monetization_billing_settings_min_lead_price_usd_check" CHECK (("min_lead_price_usd" > (0)::numeric))
);


ALTER TABLE "public"."monetization_billing_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_delivery_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notification_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "skip_reason" "text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_delivery_attempts_channel_check" CHECK (("channel" = ANY (ARRAY['in_app'::"text", 'push'::"text", 'email'::"text"]))),
    CONSTRAINT "notification_delivery_attempts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'skipped'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."notification_delivery_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_digests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "digest_kind" "text" NOT NULL,
    "summary_en" "text" NOT NULL,
    "summary_ar" "text" NOT NULL,
    "highlights" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "notification_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_digests_digest_kind_check" CHECK (("digest_kind" = ANY (ARRAY['morning'::"text", 'daily'::"text", 'weekly'::"text", 'unread'::"text"])))
);


ALTER TABLE "public"."notification_digests" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_digests" IS 'Sprint 5 Phase 6 — AI digests over notifications the user may already view.';



CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "user_id" "uuid" NOT NULL,
    "channel_in_app" boolean DEFAULT true NOT NULL,
    "channel_push" boolean DEFAULT false NOT NULL,
    "channel_email" boolean DEFAULT false NOT NULL,
    "cat_chat" boolean DEFAULT true NOT NULL,
    "cat_bookings" boolean DEFAULT true NOT NULL,
    "cat_emergency" boolean DEFAULT true NOT NULL,
    "cat_projects" boolean DEFAULT true NOT NULL,
    "cat_marketplace" boolean DEFAULT true NOT NULL,
    "cat_payments" boolean DEFAULT true NOT NULL,
    "cat_voice" boolean DEFAULT true NOT NULL,
    "cat_tasks" boolean DEFAULT true NOT NULL,
    "cat_approvals" boolean DEFAULT true NOT NULL,
    "cat_recurring" boolean DEFAULT true NOT NULL,
    "cat_invoices" boolean DEFAULT true NOT NULL,
    "cat_admin" boolean DEFAULT true NOT NULL,
    "quiet_hours_enabled" boolean DEFAULT false NOT NULL,
    "quiet_hours_start" time without time zone,
    "quiet_hours_end" time without time zone,
    "quiet_hours_timezone" "text" DEFAULT 'Asia/Damascus'::"text" NOT NULL,
    "digest_morning" boolean DEFAULT false NOT NULL,
    "digest_daily" boolean DEFAULT false NOT NULL,
    "digest_weekly" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_preferences" IS 'Sprint 5 Phase 6 — per-user channel/category/quiet-hours preferences.';



CREATE TABLE IF NOT EXISTS "public"."notification_push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text",
    "auth" "text",
    "user_agent" "text",
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notification_push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."offer_clarifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "offer_id" "uuid" NOT NULL,
    "service_request_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "author_role" "text" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "offer_clarifications_author_role_check" CHECK (("author_role" = ANY (ARRAY['customer'::"text", 'provider'::"text"]))),
    CONSTRAINT "offer_clarifications_body_check" CHECK ((("char_length"("body") >= 1) AND ("char_length"("body") <= 500)))
);


ALTER TABLE "public"."offer_clarifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."offer_clarifications" IS 'Limited pre-unlock Q&A on an offer. Not messaging/chat (Sprint 7).';



CREATE TABLE IF NOT EXISTS "public"."offer_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "price" numeric(12,2),
    "currency" "text" DEFAULT 'SYP'::"text" NOT NULL,
    "price_model" "text" DEFAULT 'fixed'::"text" NOT NULL,
    "inclusions" "text",
    "eta_text" "text",
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "offer_templates_price_model_check" CHECK (("price_model" = ANY (ARRAY['fixed'::"text", 'hourly'::"text", 'estimate'::"text"])))
);


ALTER TABLE "public"."offer_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."offer_templates" IS 'Provider offer drafts for <60s create (Sprint 4). Not ranking/visibility boosts.';



CREATE TABLE IF NOT EXISTS "public"."payment_disputes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid",
    "provider_id" "uuid",
    "stripe_dispute_id" "text",
    "stripe_charge_id" "text",
    "status" "text" DEFAULT 'opened'::"text" NOT NULL,
    "reason" "text",
    "amount" numeric(12,2),
    "currency" "text" DEFAULT 'USD'::"text",
    "evidence_due_by" timestamp with time zone,
    "resolution" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "opened_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_disputes_status_check" CHECK (("status" = ANY (ARRAY['opened'::"text", 'evidence_requested'::"text", 'evidence_submitted'::"text", 'under_review'::"text", 'won'::"text", 'lost'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."payment_disputes" OWNER TO "postgres";


COMMENT ON TABLE "public"."payment_disputes" IS 'Sprint 6 Phase 5 — Stripe/payment disputes.';



CREATE TABLE IF NOT EXISTS "public"."payment_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "event_type" character varying(40) NOT NULL,
    "actor_id" "uuid",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payment_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_provider_event_types" (
    "event_type" "text" NOT NULL,
    "description" "text" NOT NULL
);


ALTER TABLE "public"."payment_provider_event_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_status_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "actor_user_id" "uuid",
    "source" "text" DEFAULT 'system'::"text" NOT NULL,
    "note" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_status_snapshots_source_check" CHECK (("source" = ANY (ARRAY['system'::"text", 'admin'::"text", 'webhook'::"text", 'provider'::"text", 'cron'::"text", 'user'::"text"])))
);


ALTER TABLE "public"."payment_status_snapshots" OWNER TO "postgres";


COMMENT ON TABLE "public"."payment_status_snapshots" IS 'Sprint 6 Phase 2 — append-only immutable payment status history.';



CREATE TABLE IF NOT EXISTS "public"."payment_webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider" "text" DEFAULT 'manual'::"text" NOT NULL,
    "external_event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "processing_status" "text" DEFAULT 'received'::"text" NOT NULL,
    "payment_id" "uuid",
    "error_message" "text",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "last_retry_at" timestamp with time zone,
    "signature_valid" boolean,
    CONSTRAINT "payment_webhook_events_processing_status_check" CHECK (("processing_status" = ANY (ARRAY['received'::"text", 'processed'::"text", 'ignored'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."payment_webhook_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."payment_webhook_events" IS 'Idempotent ledger for payment webhooks and verified server-side capture events (Sprint 6).';



CREATE TABLE IF NOT EXISTS "public"."pdf_generation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid",
    "payment_id" "uuid",
    "action" "text" NOT NULL,
    "success" boolean DEFAULT true NOT NULL,
    "error_message" "text",
    "actor_user_id" "uuid",
    "duration_ms" integer,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pdf_generation_logs_action_check" CHECK (("action" = ANY (ARRAY['generate'::"text", 'regenerate'::"text", 'fail'::"text"])))
);


ALTER TABLE "public"."pdf_generation_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "alert_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "source" "text" DEFAULT 'rule'::"text" NOT NULL,
    "anomaly_id" "uuid",
    "threshold_value" numeric(14,4),
    "current_value" numeric(14,4),
    "assigned_admin_id" "uuid",
    "acknowledged_by" "uuid",
    "acknowledged_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_alerts_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "platform_alerts_source_check" CHECK (("source" = ANY (ARRAY['rule'::"text", 'anomaly'::"text", 'manual'::"text", 'system'::"text"]))),
    CONSTRAINT "platform_alerts_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'acknowledged'::"text", 'resolved'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."platform_alerts" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_alerts" IS 'Configurable operational alerts for ops teams.';



CREATE TABLE IF NOT EXISTS "public"."platform_anomalies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "anomaly_type" "text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text",
    "metric_key" "text",
    "baseline_value" numeric(14,4),
    "current_value" numeric(14,4),
    "deviation_pct" numeric(10,4),
    "scope_type" "text",
    "scope_id" "text",
    "detected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "false_positive" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "platform_anomalies_anomaly_type_check" CHECK (("anomaly_type" = ANY (ARRAY['refund_spike'::"text", 'review_spike'::"text", 'booking_drop'::"text", 'category_anomaly'::"text", 'regional_anomaly'::"text", 'payment_anomaly'::"text", 'complaint_spike'::"text", 'verification_failures'::"text", 'fraud_spike'::"text", 'other'::"text"]))),
    CONSTRAINT "platform_anomalies_scope_type_check" CHECK ((("scope_type" IS NULL) OR ("scope_type" = ANY (ARRAY['platform'::"text", 'category'::"text", 'region'::"text", 'entity'::"text"])))),
    CONSTRAINT "platform_anomalies_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."platform_anomalies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_health_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "snapshot_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "period" "text" DEFAULT 'realtime'::"text" NOT NULL,
    "active_users" integer DEFAULT 0 NOT NULL,
    "bookings_today" integer DEFAULT 0 NOT NULL,
    "completed_jobs" integer DEFAULT 0 NOT NULL,
    "open_cases" integer DEFAULT 0 NOT NULL,
    "escalated_cases" integer DEFAULT 0 NOT NULL,
    "fraud_alerts" integer DEFAULT 0 NOT NULL,
    "trust_distribution" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "verification_pending" integer DEFAULT 0 NOT NULL,
    "verification_verified" integer DEFAULT 0 NOT NULL,
    "review_count_period" integer DEFAULT 0 NOT NULL,
    "payment_success_rate" numeric(8,4),
    "refund_rate" numeric(8,4),
    "system_health" "text" DEFAULT 'healthy'::"text" NOT NULL,
    "overall_score" numeric(8,4) DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_health_metrics_period_check" CHECK (("period" = ANY (ARRAY['realtime'::"text", 'daily'::"text", 'weekly'::"text", 'monthly'::"text", 'quarterly'::"text", 'yearly'::"text"]))),
    CONSTRAINT "platform_health_metrics_system_health_check" CHECK (("system_health" = ANY (ARRAY['healthy'::"text", 'degraded'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."platform_health_metrics" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_health_metrics" IS 'Sprint 7 Phase 6 — persisted platform health snapshots (admin-only).';



CREATE TABLE IF NOT EXISTS "public"."platform_ops_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action" "text" NOT NULL,
    "actor_id" "uuid",
    "entity_type" "text",
    "entity_id" "text",
    "note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_ops_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_ops_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "assigned_admin_id" "uuid",
    "created_by" "uuid",
    "alert_id" "uuid",
    "related_href" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "platform_ops_tasks_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "platform_ops_tasks_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'done'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."platform_ops_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_trends" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "metric_key" "text" NOT NULL,
    "period" "text" NOT NULL,
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "value" numeric(14,4) DEFAULT 0 NOT NULL,
    "previous_value" numeric(14,4),
    "change_pct" numeric(10,4),
    "direction" "text" DEFAULT 'stable'::"text" NOT NULL,
    "scope_type" "text" DEFAULT 'platform'::"text" NOT NULL,
    "scope_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_trends_direction_check" CHECK (("direction" = ANY (ARRAY['up'::"text", 'down'::"text", 'stable'::"text"]))),
    CONSTRAINT "platform_trends_period_check" CHECK (("period" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text", 'quarterly'::"text", 'yearly'::"text"]))),
    CONSTRAINT "platform_trends_scope_type_check" CHECK (("scope_type" = ANY (ARRAY['platform'::"text", 'category'::"text", 'region'::"text"])))
);


ALTER TABLE "public"."platform_trends" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing_experiments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "experiment_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "algorithm_a" "text" DEFAULT 'pricing-v1'::"text" NOT NULL,
    "algorithm_b" "text" DEFAULT 'pricing-ml-v0'::"text" NOT NULL,
    "traffic_b_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT false NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pricing_experiments_traffic_b_pct_check" CHECK ((("traffic_b_pct" >= (0)::numeric) AND ("traffic_b_pct" <= (100)::numeric)))
);


ALTER TABLE "public"."pricing_experiments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing_explanations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "history_id" "uuid",
    "code" "text" NOT NULL,
    "label_en" "text" NOT NULL,
    "label_ar" "text",
    "params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pricing_explanations" OWNER TO "postgres";


COMMENT ON TABLE "public"."pricing_explanations" IS 'Public-safe pricing explanations — no internal formula exposure.';



CREATE TABLE IF NOT EXISTS "public"."pricing_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "history_id" "uuid",
    "provider_id" "uuid",
    "customer_id" "uuid",
    "offered_price" numeric(14,2),
    "accepted" boolean,
    "completed" boolean,
    "within_suggested_range" boolean,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pricing_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "text",
    "offer_id" "uuid",
    "provider_id" "uuid",
    "customer_id" "uuid",
    "category_key" "text",
    "region_key" "text",
    "currency" "text" DEFAULT 'SYP'::"text" NOT NULL,
    "suggested_min" numeric(14,2) NOT NULL,
    "suggested_avg" numeric(14,2) NOT NULL,
    "suggested_premium" numeric(14,2) NOT NULL,
    "confidence" numeric(5,4) DEFAULT 0.5 NOT NULL,
    "market_position" "text",
    "signal_breakdown" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "algorithm_version" "text" DEFAULT 'pricing-v1'::"text" NOT NULL,
    "experiment_id" "text",
    "latency_ms" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pricing_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."pricing_history" IS 'Sprint 8 Phase 2 — price recommendations (never forced). Internal breakdown admin-only via history.';



CREATE TABLE IF NOT EXISTS "public"."pricing_market_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_key" "text" NOT NULL,
    "region_key" "text" DEFAULT 'all'::"text" NOT NULL,
    "currency" "text" DEFAULT 'SYP'::"text" NOT NULL,
    "sample_count" integer DEFAULT 0 NOT NULL,
    "avg_price" numeric(14,2),
    "p25_price" numeric(14,2),
    "p50_price" numeric(14,2),
    "p75_price" numeric(14,2),
    "min_price" numeric(14,2),
    "max_price" numeric(14,2),
    "demand_index" numeric(8,4) DEFAULT 0.5 NOT NULL,
    "acceptance_rate" numeric(8,4),
    "completion_rate" numeric(8,4),
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pricing_market_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing_weights" (
    "signal_key" "text" NOT NULL,
    "category" "text" NOT NULL,
    "weight" numeric(8,4) DEFAULT 1.0 NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "ml_ready" boolean DEFAULT false NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pricing_weights_category_check" CHECK (("category" = ANY (ARRAY['market'::"text", 'geo'::"text", 'job'::"text", 'time'::"text", 'provider'::"text", 'customer'::"text", 'risk'::"text", 'ml'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."pricing_weights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_name" character varying(100) NOT NULL,
    "avatar_url" "text",
    "bio" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_activity_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "package_id" "uuid",
    "event_key" "text" NOT NULL,
    "label_en" "text" NOT NULL,
    "label_ar" "text" NOT NULL,
    "actor" "text" DEFAULT 'system'::"text" NOT NULL,
    "actor_user_id" "uuid",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "project_activity_events_actor_check" CHECK (("actor" = ANY (ARRAY['system'::"text", 'customer'::"text", 'provider'::"text", 'admin'::"text", 'ai'::"text"])))
);


ALTER TABLE "public"."project_activity_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."project_activity_events" IS 'Sprint 5 Phase 5 — chronological collaboration activity feed.';



CREATE TABLE IF NOT EXISTS "public"."project_approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "package_id" "uuid",
    "kind" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "requested_by" "uuid",
    "decided_by" "uuid",
    "decided_at" timestamp with time zone,
    "decision_note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "project_approvals_kind_check" CHECK (("kind" = ANY (ARRAY['quotation'::"text", 'package_completed'::"text", 'additional_work'::"text", 'final_completion'::"text", 'other'::"text"]))),
    CONSTRAINT "project_approvals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."project_approvals" OWNER TO "postgres";


COMMENT ON TABLE "public"."project_approvals" IS 'Sprint 5 Phase 5 — customer/provider approval workflow.';



CREATE TABLE IF NOT EXISTS "public"."project_checklist_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "checklist_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_done" boolean DEFAULT false NOT NULL,
    "done_at" timestamp with time zone,
    "done_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_checklist_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_checklist_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title_en" "text" NOT NULL,
    "title_ar" "text" NOT NULL,
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_checklist_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_checklists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "package_id" "uuid",
    "template_slug" "text",
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_by" "uuid",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "project_checklists_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."project_checklists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_document_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "version_number" integer DEFAULT 1 NOT NULL,
    "storage_path" "text" NOT NULL,
    "bucket" "text" DEFAULT 'project-media'::"text" NOT NULL,
    "file_name" "text",
    "mime_type" "text",
    "size_bytes" bigint DEFAULT 0 NOT NULL,
    "change_note" "text",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_document_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "package_id" "uuid",
    "kind" "text" DEFAULT 'photo'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_name" "text",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bucket" "text" DEFAULT 'project-media'::"text" NOT NULL,
    "mime_type" "text",
    "size_bytes" bigint DEFAULT 0 NOT NULL,
    "width" integer,
    "height" integer,
    "duration_ms" integer,
    "thumbnail_path" "text",
    "display_name" "text",
    "gallery_category" "text" DEFAULT 'progress'::"text" NOT NULL,
    "processing_status" "text" DEFAULT 'ready'::"text" NOT NULL,
    "is_pinned" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "restore_until" timestamp with time zone,
    "media_object_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "doc_category" "text",
    "current_version" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "project_documents_doc_category_check" CHECK ((("doc_category" IS NULL) OR ("doc_category" = ANY (ARRAY['invoice'::"text", 'contract'::"text", 'certificate'::"text", 'manual'::"text", 'guarantee'::"text", 'signed'::"text", 'other'::"text"])))),
    CONSTRAINT "project_documents_gallery_category_check" CHECK (("gallery_category" = ANY (ARRAY['before'::"text", 'progress'::"text", 'completed'::"text", 'documents'::"text", 'invoices'::"text", 'certificates'::"text", 'other'::"text"]))),
    CONSTRAINT "project_documents_kind_check" CHECK (("kind" = ANY (ARRAY['photo'::"text", 'document'::"text", 'receipt'::"text", 'other'::"text", 'video'::"text", 'audio'::"text", 'invoice'::"text", 'certificate'::"text"]))),
    CONSTRAINT "project_documents_processing_status_check" CHECK (("processing_status" = ANY (ARRAY['pending'::"text", 'queued'::"text", 'processing'::"text", 'ready'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."project_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "service_request_id" "uuid",
    "trade_slug" "text" NOT NULL,
    "title_en" "text" NOT NULL,
    "title_ar" "text" NOT NULL,
    "sort_order" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "depends_on_package_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "assigned_provider_id" "uuid",
    "estimated_days" numeric,
    "actual_days" numeric,
    "scheduled_start" timestamp with time zone,
    "scheduled_end" timestamp with time zone,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "delay_hours" numeric,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "project_packages_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'matching'::"text", 'offers'::"text", 'booked'::"text", 'blocked'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."project_packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "package_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'todo'::"text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "due_at" timestamp with time zone,
    "assigned_user_id" "uuid",
    "assigned_role" "text",
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "created_by" "uuid",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "project_tasks_assigned_role_check" CHECK ((("assigned_role" IS NULL) OR ("assigned_role" = ANY (ARRAY['customer'::"text", 'provider'::"text", 'admin'::"text", 'either'::"text"])))),
    CONSTRAINT "project_tasks_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "project_tasks_status_check" CHECK (("status" = ANY (ARRAY['todo'::"text", 'in_progress'::"text", 'blocked'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."project_tasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."project_tasks" IS 'Sprint 5 Phase 5 — shared collaboration tasks. AI never mutates these automatically.';



CREATE TABLE IF NOT EXISTS "public"."project_timeline_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "package_id" "uuid",
    "event_key" "text" NOT NULL,
    "label_en" "text" NOT NULL,
    "label_ar" "text" NOT NULL,
    "actor" "text" DEFAULT 'system'::"text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "project_timeline_events_actor_check" CHECK (("actor" = ANY (ARRAY['system'::"text", 'customer'::"text", 'provider'::"text", 'admin'::"text", 'ai'::"text"])))
);


ALTER TABLE "public"."project_timeline_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_availability_breaks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "starts_at" time without time zone NOT NULL,
    "ends_at" time without time zone NOT NULL,
    "label" "text",
    CONSTRAINT "breaks_time_order" CHECK (("ends_at" > "starts_at")),
    CONSTRAINT "provider_availability_breaks_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."provider_availability_breaks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_availability_settings" (
    "provider_id" "uuid" NOT NULL,
    "timezone" "text" DEFAULT 'Asia/Damascus'::"text" NOT NULL,
    "slot_durations" integer[] DEFAULT ARRAY[30, 60] NOT NULL,
    "buffer_minutes" integer DEFAULT 0 NOT NULL,
    "min_notice_hours" integer DEFAULT 2 NOT NULL,
    "max_days_ahead" integer DEFAULT 60 NOT NULL,
    "emergency_available" boolean DEFAULT false NOT NULL,
    "accepting_bookings" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "default_appointment_type" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "travel_buffer_minutes" integer DEFAULT 20 NOT NULL,
    CONSTRAINT "provider_availability_settings_buffer_minutes_check" CHECK ((("buffer_minutes" >= 0) AND ("buffer_minutes" <= 120))),
    CONSTRAINT "provider_availability_settings_default_appointment_type_check" CHECK (("default_appointment_type" = ANY (ARRAY['immediate'::"text", 'today'::"text", 'scheduled'::"text", 'recurring'::"text", 'emergency'::"text", 'video'::"text"]))),
    CONSTRAINT "provider_availability_settings_max_days_ahead_check" CHECK ((("max_days_ahead" >= 1) AND ("max_days_ahead" <= 365))),
    CONSTRAINT "provider_availability_settings_min_notice_hours_check" CHECK (("min_notice_hours" >= 0)),
    CONSTRAINT "provider_availability_settings_travel_buffer_minutes_check" CHECK ((("travel_buffer_minutes" >= 0) AND ("travel_buffer_minutes" <= 120)))
);


ALTER TABLE "public"."provider_availability_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_blocked_times" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "reason" "text",
    "kind" "text" DEFAULT 'blocked'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "blocked_time_order" CHECK (("ends_at" > "starts_at")),
    CONSTRAINT "provider_blocked_times_kind_check" CHECK (("kind" = ANY (ARRAY['blocked'::"text", 'vacation'::"text", 'holiday'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."provider_blocked_times" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_capacity" (
    "provider_id" "uuid" NOT NULL,
    "max_daily_jobs" integer DEFAULT 8 NOT NULL,
    "jobs_today" integer DEFAULT 0 NOT NULL,
    "vacation_mode" boolean DEFAULT false NOT NULL,
    "pause_mode" boolean DEFAULT false NOT NULL,
    "accepting_requests" boolean DEFAULT true NOT NULL,
    "business_hours" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "next_available_at" timestamp with time zone,
    "workload_score" numeric(5,4) DEFAULT 0.5 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."provider_capacity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_engagement_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "event_type" character varying(40) NOT NULL,
    "search_log_id" "uuid",
    "position" smallint,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provider_engagement_events_type_chk" CHECK ((("event_type")::"text" = ANY ((ARRAY['impression'::character varying, 'serp_click'::character varying, 'profile_view'::character varying, 'contact_phone'::character varying, 'contact_whatsapp'::character varying, 'favorite'::character varying])::"text"[])))
);


ALTER TABLE "public"."provider_engagement_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_monetization_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "billing_mode" "text" DEFAULT 'free'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "business_started_at" timestamp with time zone,
    "business_expires_at" timestamp with time zone,
    "billing_period_start" "date",
    "billing_period_end" "date",
    "premium_badge" boolean DEFAULT false NOT NULL,
    "search_boost" boolean DEFAULT false NOT NULL,
    "analytics_enabled" boolean DEFAULT false NOT NULL,
    "marketing_enabled" boolean DEFAULT false NOT NULL,
    "ai_insights_enabled" boolean DEFAULT false NOT NULL,
    "subscription_payment_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "cancel_at_period_end" boolean DEFAULT false NOT NULL,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "renewal_cancelled_at" timestamp with time zone,
    CONSTRAINT "provider_monetization_plans_billing_mode_check" CHECK (("billing_mode" = ANY (ARRAY['free'::"text", 'business'::"text"]))),
    CONSTRAINT "provider_monetization_plans_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'past_due'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."provider_monetization_plans" OWNER TO "postgres";


COMMENT ON TABLE "public"."provider_monetization_plans" IS 'Sprint 6 Phase 1 — FREE (pay-per-lead) vs BUSINESS ($20/mo, 10 included unlocks).';



COMMENT ON COLUMN "public"."provider_monetization_plans"."stripe_subscription_id" IS 'Sprint 6 Phase 3 — Stripe Billing subscription for Business plan.';



CREATE TABLE IF NOT EXISTS "public"."provider_monthly_unlock_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "period_ym" "text" NOT NULL,
    "included_allowance" integer DEFAULT 10 NOT NULL,
    "used_count" integer DEFAULT 0 NOT NULL,
    "reset_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provider_monthly_unlock_usage_included_allowance_check" CHECK (("included_allowance" >= 0)),
    CONSTRAINT "provider_monthly_unlock_usage_used_count_check" CHECK (("used_count" >= 0))
);


ALTER TABLE "public"."provider_monthly_unlock_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_opportunities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "gap_id" "uuid",
    "request_id" "text",
    "assignment_id" "uuid",
    "title_en" "text" NOT NULL,
    "title_ar" "text",
    "distance_km" numeric(10,2),
    "travel_minutes" numeric(10,2),
    "expected_earnings" numeric(14,2),
    "expected_duration_min" integer,
    "matching_score" numeric(8,4),
    "opportunity_score" numeric(8,4),
    "currency" "text" DEFAULT 'SYP'::"text" NOT NULL,
    "status" "text" DEFAULT 'suggested'::"text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "decided_at" timestamp with time zone,
    CONSTRAINT "provider_opportunities_status_check" CHECK (("status" = ANY (ARRAY['suggested'::"text", 'accepted'::"text", 'ignored'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."provider_opportunities" OWNER TO "postgres";


COMMENT ON TABLE "public"."provider_opportunities" IS 'Gap-fill / idle-time opportunities — provider decides; never auto-book.';



CREATE TABLE IF NOT EXISTS "public"."provider_opportunity_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "opportunity_id" "uuid",
    "provider_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provider_opportunity_history_action_check" CHECK (("action" = ANY (ARRAY['shown'::"text", 'accepted'::"text", 'ignored'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."provider_opportunity_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_performance_scores" (
    "provider_id" "uuid" NOT NULL,
    "performance_score" numeric(6,4) DEFAULT 0.5000 NOT NULL,
    "acceptance_rate" numeric(6,4),
    "completion_rate" numeric(6,4),
    "avg_rating" numeric(4,2),
    "avg_response_hours" numeric(10,2),
    "cancellation_rate" numeric(6,4),
    "repeat_customer_rate" numeric(6,4),
    "successful_jobs" integer DEFAULT 0 NOT NULL,
    "sample_size" integer DEFAULT 0 NOT NULL,
    "data_quality" numeric(6,4) DEFAULT 0 NOT NULL,
    "factors" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provider_performance_scores_data_quality_check" CHECK ((("data_quality" >= (0)::numeric) AND ("data_quality" <= (1)::numeric))),
    CONSTRAINT "provider_performance_scores_performance_score_check" CHECK ((("performance_score" >= (0)::numeric) AND ("performance_score" <= (1)::numeric)))
);


ALTER TABLE "public"."provider_performance_scores" OWNER TO "postgres";


COMMENT ON TABLE "public"."provider_performance_scores" IS 'Cached AI Performance Score per provider. Internal only — never expose raw score publicly.';



CREATE TABLE IF NOT EXISTS "public"."provider_reputation_scores" (
    "provider_id" "uuid" NOT NULL,
    "internal_score" numeric(6,2) DEFAULT 0 NOT NULL,
    "trust_level" "text" DEFAULT 'new_provider'::"text" NOT NULL,
    "search_boost" numeric(6,4) DEFAULT 0 NOT NULL,
    "recommendation_boost" numeric(6,4) DEFAULT 0 NOT NULL,
    "trend" "text" DEFAULT 'stable'::"text" NOT NULL,
    "signal_breakdown" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "previous_score" numeric(6,2),
    "previous_trust_level" "text",
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "model_version" "text" DEFAULT 'reputation-engine-v1'::"text" NOT NULL,
    CONSTRAINT "provider_reputation_scores_trend_check" CHECK (("trend" = ANY (ARRAY['rising'::"text", 'stable'::"text", 'declining'::"text"]))),
    CONSTRAINT "provider_reputation_scores_trust_level_check" CHECK (("trust_level" = ANY (ARRAY['excellent'::"text", 'very_good'::"text", 'good'::"text", 'developing'::"text", 'new_provider'::"text", 'needs_attention'::"text"])))
);


ALTER TABLE "public"."provider_reputation_scores" OWNER TO "postgres";


COMMENT ON TABLE "public"."provider_reputation_scores" IS 'Sprint 7 Phase 3 — internal reputation scores. Never expose internal_score to customers.';



CREATE OR REPLACE VIEW "public"."provider_public_trust" AS
 SELECT "provider_id",
    "trust_level",
    "trend",
    "computed_at"
   FROM "public"."provider_reputation_scores";


ALTER VIEW "public"."provider_public_trust" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_reputation_cache" (
    "provider_id" "uuid" NOT NULL,
    "recommendation_rate" numeric(5,2),
    "ai_summary_en" "text",
    "ai_summary_ar" "text",
    "quality_label" "text",
    "response_rate" numeric(5,2),
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "trust_level" "text",
    "trend" "text"
);


ALTER TABLE "public"."provider_reputation_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_reputation_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "actor_id" "uuid",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provider_reputation_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['reputation_recalculated'::"text", 'signal_updated'::"text", 'trust_level_changed'::"text", 'search_boost_changed'::"text", 'recommendation_boost_changed'::"text", 'trend_generated'::"text", 'manual_override'::"text"])))
);


ALTER TABLE "public"."provider_reputation_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_reputation_explanations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "audience" "text" NOT NULL,
    "locale" "text" DEFAULT 'en'::"text" NOT NULL,
    "explanation_key" "text",
    "body" "text" NOT NULL,
    "polarity" "text" DEFAULT 'positive'::"text" NOT NULL,
    "sort_order" smallint DEFAULT 0 NOT NULL,
    "signal_key" "text",
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provider_reputation_explanations_audience_check" CHECK (("audience" = ANY (ARRAY['public'::"text", 'provider'::"text", 'admin'::"text"]))),
    CONSTRAINT "provider_reputation_explanations_polarity_check" CHECK (("polarity" = ANY (ARRAY['positive'::"text", 'neutral'::"text", 'improvement'::"text"])))
);


ALTER TABLE "public"."provider_reputation_explanations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_reputation_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "period" "text" NOT NULL,
    "internal_score" numeric(6,2) NOT NULL,
    "trust_level" "text" NOT NULL,
    "trend" "text" DEFAULT 'stable'::"text" NOT NULL,
    "signal_breakdown" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "search_boost" numeric(6,4),
    "recommendation_boost" numeric(6,4),
    "important_changes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "period_start" "date",
    "period_end" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provider_reputation_history_period_check" CHECK (("period" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text", 'snapshot'::"text"])))
);


ALTER TABLE "public"."provider_reputation_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_reputation_signals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "signal_key" "text" NOT NULL,
    "category" "text" NOT NULL,
    "raw_value" numeric(12,4),
    "normalized_value" numeric(8,4) DEFAULT 0 NOT NULL,
    "weight" numeric(8,4) DEFAULT 1 NOT NULL,
    "contribution" numeric(8,4) DEFAULT 0 NOT NULL,
    "source" "text" DEFAULT 'heuristic'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provider_reputation_signals_source_check" CHECK (("source" = ANY (ARRAY['heuristic'::"text", 'ml'::"text", 'manual'::"text", 'import'::"text"])))
);


ALTER TABLE "public"."provider_reputation_signals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_reputation_weights" (
    "signal_key" "text" NOT NULL,
    "category" "text" NOT NULL,
    "weight" numeric(8,4) DEFAULT 1.0 NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "ml_ready" boolean DEFAULT true NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provider_reputation_weights_category_check" CHECK (("category" = ANY (ARRAY['verification'::"text", 'reviews'::"text", 'booking'::"text", 'communication'::"text", 'reliability'::"text", 'activity'::"text"]))),
    CONSTRAINT "provider_reputation_weights_weight_check" CHECK (("weight" >= (0)::numeric))
);


ALTER TABLE "public"."provider_reputation_weights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_request_settings" (
    "provider_id" "uuid" NOT NULL,
    "accepting_requests" boolean DEFAULT true NOT NULL,
    "max_pending_requests" smallint DEFAULT 50 NOT NULL,
    "auto_reject_message" "text",
    "vacation_mode" boolean DEFAULT false NOT NULL,
    "estimated_response_hours" smallint DEFAULT 24 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "handles_emergency" boolean DEFAULT true NOT NULL,
    CONSTRAINT "provider_request_settings_estimated_response_hours_check" CHECK ((("estimated_response_hours" >= 1) AND ("estimated_response_hours" <= 168))),
    CONSTRAINT "provider_request_settings_max_pending_requests_check" CHECK ((("max_pending_requests" >= 1) AND ("max_pending_requests" <= 200)))
);


ALTER TABLE "public"."provider_request_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."provider_request_settings"."handles_emergency" IS 'Sprint 8: when false, provider is excluded from emergency urgency match pools. Pause still uses vacation_mode / accepting_requests.';



CREATE TABLE IF NOT EXISTS "public"."service_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_request_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "rating" smallint NOT NULL,
    "comment" "text",
    "recommend" boolean,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "status" "public"."review_status" DEFAULT 'approved'::"public"."review_status" NOT NULL,
    "is_anonymous" boolean DEFAULT false NOT NULL,
    "is_verified" boolean DEFAULT true NOT NULL,
    "verified_booking" boolean DEFAULT true NOT NULL,
    "verified_customer" boolean DEFAULT true NOT NULL,
    "verified_interaction" boolean DEFAULT true NOT NULL,
    "helpful_count" integer DEFAULT 0 NOT NULL,
    "provider_reply" "text",
    "provider_replied_at" timestamp with time zone,
    "provider_reply_by" "uuid",
    "booking_id" "uuid",
    "language" "text" DEFAULT 'en'::"text",
    "editable_until" timestamp with time zone,
    "edit_count" integer DEFAULT 0 NOT NULL,
    "delete_requested_at" timestamp with time zone,
    "delete_request_reason" "text",
    "ai_summary" "text",
    "sentiment" "text",
    CONSTRAINT "service_reviews_helpful_count_check" CHECK (("helpful_count" >= 0)),
    CONSTRAINT "service_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "service_reviews_sentiment_check" CHECK ((("sentiment" IS NULL) OR ("sentiment" = ANY (ARRAY['positive'::"text", 'neutral'::"text", 'negative'::"text", 'mixed'::"text"]))))
);


ALTER TABLE "public"."service_reviews" OWNER TO "postgres";


COMMENT ON COLUMN "public"."service_reviews"."status" IS 'Moderation status. Public lists only show approved + not soft-deleted.';



COMMENT ON COLUMN "public"."service_reviews"."is_verified" IS 'True when review comes from a completed Dalily booking.';



COMMENT ON COLUMN "public"."service_reviews"."helpful_count" IS 'Denormalized count of helpful votes — source of truth is service_review_helpful_votes.';



CREATE OR REPLACE VIEW "public"."provider_reviews" AS
 SELECT "id",
    "service_request_id",
    "provider_id",
    "customer_id",
    "rating",
    "comment",
    "recommend",
    "created_at",
    "updated_at",
    "deleted_at",
    "status",
    "is_anonymous",
    "is_verified",
    "verified_booking",
    "verified_customer",
    "verified_interaction",
    "helpful_count",
    "provider_reply",
    "provider_replied_at",
    "provider_reply_by",
    "booking_id",
    "language",
    "editable_until",
    "edit_count",
    "delete_requested_at",
    "delete_request_reason",
    "ai_summary",
    "sentiment"
   FROM "public"."service_reviews";


ALTER VIEW "public"."provider_reviews" OWNER TO "postgres";


COMMENT ON VIEW "public"."provider_reviews" IS 'Sprint 7 Phase 2 — alias of service_reviews for reputation domain naming.';



CREATE TABLE IF NOT EXISTS "public"."provider_routes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "route_date" "date" NOT NULL,
    "stops" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "total_distance_km" numeric(10,2),
    "total_travel_min" numeric(10,2),
    "algorithm_version" "text" DEFAULT 'schedule-v1'::"text" NOT NULL,
    "cached_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."provider_routes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_schedule_gaps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "gap_date" "date" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "duration_minutes" integer NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provider_schedule_gaps_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'filled'::"text", 'ignored'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."provider_schedule_gaps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "name" "jsonb" NOT NULL,
    "description" "jsonb",
    "sort_order" smallint DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."provider_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_verification_checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "type_slug" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "verified_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "internal_note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provider_verification_checks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."provider_verification_checks" OWNER TO "postgres";


COMMENT ON TABLE "public"."provider_verification_checks" IS 'Per-provider verification outcomes. Public UI only exposes verified rows (no docs/PII).';



CREATE TABLE IF NOT EXISTS "public"."provider_verifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "id_front_url" "text",
    "id_back_url" "text",
    "selfie_url" "text",
    "status" "public"."provider_verification_status" DEFAULT 'pending'::"public"."provider_verification_status" NOT NULL,
    "rejection_reason" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."provider_verifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_working_hours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "day_of_week" smallint NOT NULL,
    "opens_at" time without time zone,
    "closes_at" time without time zone,
    "is_closed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provider_working_hours_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."provider_working_hours" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "slug" character varying(120) NOT NULL,
    "name" "jsonb" NOT NULL,
    "about" "jsonb",
    "module_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "city_id" "uuid" NOT NULL,
    "district_id" "uuid",
    "address_line" "jsonb",
    "latitude" numeric(10,7),
    "longitude" numeric(10,7),
    "phone" character varying(20),
    "whatsapp" character varying(20),
    "email" character varying(255),
    "website" character varying(500),
    "cover_image_id" "uuid",
    "avatar_image_id" "uuid",
    "status" "public"."provider_status" DEFAULT 'draft'::"public"."provider_status" NOT NULL,
    "verification_status" "public"."verification_status" DEFAULT 'unverified'::"public"."verification_status" NOT NULL,
    "trust_score" smallint DEFAULT 0 NOT NULL,
    "rating_avg" numeric(3,2) DEFAULT 0.00 NOT NULL,
    "review_count" integer DEFAULT 0 NOT NULL,
    "response_time_hours" smallint,
    "profile_completeness" smallint DEFAULT 0 NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "featured_until" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid",
    "admin_review_note" "text",
    "changes_requested_at" timestamp with time zone,
    "share_live_location_enabled" boolean DEFAULT true NOT NULL,
    CONSTRAINT "providers_profile_completeness_check" CHECK ((("profile_completeness" >= 0) AND ("profile_completeness" <= 100))),
    CONSTRAINT "providers_trust_score_check" CHECK ((("trust_score" >= 0) AND ("trust_score" <= 100)))
);


ALTER TABLE "public"."providers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."providers"."admin_review_note" IS 'Latest admin note when requesting changes or rejecting a business.';



COMMENT ON COLUMN "public"."providers"."changes_requested_at" IS 'When the admin last requested changes from the business.';



CREATE TABLE IF NOT EXISTS "public"."quality_case_ai_analysis" (
    "case_id" "uuid" NOT NULL,
    "sentiment" "text",
    "severity" numeric(5,4) DEFAULT 0 NOT NULL,
    "urgency" numeric(5,4) DEFAULT 0 NOT NULL,
    "risk_level" "text" DEFAULT 'medium'::"text" NOT NULL,
    "suggested_category" "text",
    "suggested_priority" "text",
    "suggested_resolution" "text",
    "repeated_pattern" boolean DEFAULT false NOT NULL,
    "pattern_notes" "text",
    "topics" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "model_version" "text" DEFAULT 'quality-heuristic-v1'::"text" NOT NULL,
    "analyzed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "quality_case_ai_analysis_risk_level_check" CHECK (("risk_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "quality_case_ai_analysis_sentiment_check" CHECK ((("sentiment" IS NULL) OR ("sentiment" = ANY (ARRAY['positive'::"text", 'neutral'::"text", 'negative'::"text", 'mixed'::"text"]))))
);


ALTER TABLE "public"."quality_case_ai_analysis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quality_case_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "unassigned_at" timestamp with time zone,
    "note" "text"
);


ALTER TABLE "public"."quality_case_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quality_case_evidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "evidence_type" "text" NOT NULL,
    "uploaded_by" "uuid",
    "bucket" "text" DEFAULT 'service-request-media'::"text" NOT NULL,
    "path" "text",
    "mime_type" "text",
    "size_bytes" integer,
    "reference_id" "uuid",
    "reference_label" "text",
    "moderation_status" "text" DEFAULT 'approved'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "quality_case_evidence_evidence_type_check" CHECK (("evidence_type" = ANY (ARRAY['photo'::"text", 'video'::"text", 'document'::"text", 'chat_reference'::"text", 'booking_history'::"text", 'payment_reference'::"text", 'review_reference'::"text", 'other'::"text"]))),
    CONSTRAINT "quality_case_evidence_moderation_status_check" CHECK (("moderation_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'hidden'::"text"])))
);


ALTER TABLE "public"."quality_case_evidence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quality_case_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "from_status" "text",
    "to_status" "text",
    "action" "text" NOT NULL,
    "actor_id" "uuid",
    "actor_role" "text",
    "note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "quality_case_history_action_check" CHECK (("action" = ANY (ARRAY['created'::"text", 'status_changed'::"text", 'assigned'::"text", 'unassigned'::"text", 'escalated'::"text", 'merged'::"text", 'evidence_requested'::"text", 'resolved'::"text", 'rejected'::"text", 'closed'::"text", 'reopened'::"text", 'note_added'::"text", 'priority_changed'::"text"])))
);


ALTER TABLE "public"."quality_case_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."quality_case_history" IS 'Immutable audit trail of quality case status/actions.';



CREATE TABLE IF NOT EXISTS "public"."quality_case_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "author_id" "uuid",
    "author_role" "text" NOT NULL,
    "visibility" "text" DEFAULT 'shared'::"text" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "quality_case_messages_author_role_check" CHECK (("author_role" = ANY (ARRAY['customer'::"text", 'provider'::"text", 'admin'::"text", 'system'::"text"]))),
    CONSTRAINT "quality_case_messages_visibility_check" CHECK (("visibility" = ANY (ARRAY['shared'::"text", 'internal'::"text"])))
);


ALTER TABLE "public"."quality_case_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quality_case_metrics" (
    "provider_id" "uuid" NOT NULL,
    "total_cases" integer DEFAULT 0 NOT NULL,
    "open_cases" integer DEFAULT 0 NOT NULL,
    "resolved_cases" integer DEFAULT 0 NOT NULL,
    "rejected_cases" integer DEFAULT 0 NOT NULL,
    "complaint_rate" numeric(8,4),
    "resolution_rate" numeric(8,4),
    "avg_resolution_hours" numeric(10,2),
    "repeat_complaint_count" integer DEFAULT 0 NOT NULL,
    "avg_satisfaction" numeric(4,2),
    "category_breakdown" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "trend" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."quality_case_metrics" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."quality_case_number_seq"
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."quality_case_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quality_cases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_number" "text" NOT NULL,
    "category" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "opened_by_role" "text" NOT NULL,
    "opened_by" "uuid",
    "customer_id" "uuid",
    "provider_id" "uuid",
    "booking_id" "uuid",
    "payment_id" "uuid",
    "service_request_id" "uuid",
    "review_id" "uuid",
    "booking_issue_report_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "resolution_summary" "text",
    "satisfaction_score" smallint,
    "assigned_admin_id" "uuid",
    "escalated_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "merged_into_case_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "quality_cases_category_check" CHECK (("category" = ANY (ARRAY['customer_complaint'::"text", 'provider_complaint'::"text", 'booking_issue'::"text", 'service_quality'::"text", 'communication'::"text", 'damage_report'::"text", 'late_arrival'::"text", 'no_show'::"text", 'policy_violation'::"text", 'other'::"text"]))),
    CONSTRAINT "quality_cases_opened_by_role_check" CHECK (("opened_by_role" = ANY (ARRAY['customer'::"text", 'provider'::"text", 'admin'::"text", 'system'::"text"]))),
    CONSTRAINT "quality_cases_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "quality_cases_satisfaction_score_check" CHECK ((("satisfaction_score" IS NULL) OR (("satisfaction_score" >= 1) AND ("satisfaction_score" <= 5)))),
    CONSTRAINT "quality_cases_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'pending_information'::"text", 'under_review'::"text", 'waiting_for_provider'::"text", 'waiting_for_customer'::"text", 'resolved'::"text", 'rejected'::"text", 'escalated'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."quality_cases" OWNER TO "postgres";


COMMENT ON TABLE "public"."quality_cases" IS 'Sprint 7 Phase 4 — marketplace quality / complaint cases.';



CREATE TABLE IF NOT EXISTS "public"."quote_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "label" character varying(200) NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "sort_order" smallint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "quote_items_amount_check" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."quote_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_request_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "price" numeric(12,2) NOT NULL,
    "currency" character varying(8) DEFAULT 'SYP'::character varying NOT NULL,
    "estimated_duration_text" character varying(120),
    "notes" "text",
    "status" character varying(20) DEFAULT 'sent'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "responded_at" timestamp with time zone,
    CONSTRAINT "quotes_price_check" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "quotes_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['sent'::character varying, 'accepted'::character varying, 'declined'::character varying, 'changes_requested'::character varying, 'superseded'::character varying])::"text"[])))
);


ALTER TABLE "public"."quotes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."receipt_metadata" (
    "document_id" "uuid" NOT NULL,
    "lead_id" "text",
    "unlock_session_id" "uuid",
    "unlock_date" timestamp with time zone,
    "ai_price_usd" numeric(10,2),
    "pricing_explanation" "text",
    "estimated_project_value" numeric(12,2),
    "estimated_duration_hours" numeric(8,2),
    "provider_name" "text",
    "payment_reference" "text",
    "stripe_payment_intent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."receipt_metadata" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "provider_id" "uuid",
    "category_slug" "text",
    "service_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "interval_kind" "text" NOT NULL,
    "custom_interval_days" integer,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "auto_renew" boolean DEFAULT true NOT NULL,
    "preferred_weekdays" integer[] DEFAULT '{}'::integer[] NOT NULL,
    "preferred_time_start" time without time zone,
    "preferred_time_end" time without time zone,
    "duration_minutes" integer DEFAULT 60 NOT NULL,
    "timezone" "text" DEFAULT 'Asia/Damascus'::"text" NOT NULL,
    "location_text" "text",
    "emergency_contact" "text",
    "notes" "text",
    "next_visit_at" timestamp with time zone,
    "last_visit_at" timestamp with time zone,
    "paused_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "renew_count" integer DEFAULT 0 NOT NULL,
    "completed_visit_count" integer DEFAULT 0 NOT NULL,
    "skipped_visit_count" integer DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "recurring_plans_custom_interval_days_check" CHECK ((("custom_interval_days" IS NULL) OR (("custom_interval_days" >= 1) AND ("custom_interval_days" <= 730)))),
    CONSTRAINT "recurring_plans_duration_minutes_check" CHECK (("duration_minutes" = ANY (ARRAY[30, 60, 90, 120, 180, 240]))),
    CONSTRAINT "recurring_plans_interval_kind_check" CHECK (("interval_kind" = ANY (ARRAY['weekly'::"text", 'biweekly'::"text", 'monthly'::"text", 'quarterly'::"text", 'semiannual'::"text", 'yearly'::"text", 'custom'::"text"]))),
    CONSTRAINT "recurring_plans_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text", 'cancelled'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."recurring_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_recommendations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "provider_id" "uuid",
    "category_slug" "text",
    "suggested_interval" "text" NOT NULL,
    "title_en" "text" NOT NULL,
    "title_ar" "text" NOT NULL,
    "reason_en" "text" NOT NULL,
    "reason_ar" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "based_on_booking_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "created_plan_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "recurring_recommendations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."recurring_recommendations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_reminder_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid",
    "visit_id" "uuid",
    "reminder_type" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "recurring_reminder_log_reminder_type_check" CHECK (("reminder_type" = ANY (ARRAY['upcoming_visit'::"text", 'plan_renewal'::"text", 'visit_skipped'::"text", 'plan_paused'::"text", 'plan_cancelled'::"text", 'maintenance_due'::"text"])))
);


ALTER TABLE "public"."recurring_reminder_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_visits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "booking_id" "uuid",
    "sequence_number" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "planned_starts_at" timestamp with time zone NOT NULL,
    "planned_ends_at" timestamp with time zone NOT NULL,
    "actual_starts_at" timestamp with time zone,
    "actual_ends_at" timestamp with time zone,
    "skip_reason" "text",
    "reschedule_note" "text",
    "reminder_sent_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "recurring_visits_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'confirmed'::"text", 'skipped'::"text", 'rescheduled'::"text", 'completed'::"text", 'cancelled'::"text", 'missed'::"text"])))
);


ALTER TABLE "public"."recurring_visits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refund_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "refund_request_id" "uuid" NOT NULL,
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "actor_user_id" "uuid",
    "source" "text" DEFAULT 'system'::"text" NOT NULL,
    "note" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "refund_history_source_check" CHECK (("source" = ANY (ARRAY['system'::"text", 'admin'::"text", 'provider'::"text", 'webhook'::"text", 'stripe'::"text"])))
);


ALTER TABLE "public"."refund_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refund_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "refund_type" "text" NOT NULL,
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "original_amount" numeric(12,2) NOT NULL,
    "refund_amount" numeric(12,2) NOT NULL,
    "remaining_amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "reason" "text" DEFAULT ''::"text" NOT NULL,
    "requested_by" "uuid",
    "approved_by" "uuid",
    "rejected_by" "uuid",
    "rejection_reason" "text",
    "stripe_refund_id" "text",
    "payment_reference" "text",
    "financial_document_id" "uuid",
    "completed_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "refund_requests_check" CHECK (("refund_amount" <= "original_amount")),
    CONSTRAINT "refund_requests_refund_amount_check" CHECK (("refund_amount" > (0)::numeric)),
    CONSTRAINT "refund_requests_refund_type_check" CHECK (("refund_type" = ANY (ARRAY['full'::"text", 'partial'::"text", 'manual'::"text", 'automatic'::"text"]))),
    CONSTRAINT "refund_requests_remaining_amount_check" CHECK (("remaining_amount" >= (0)::numeric)),
    CONSTRAINT "refund_requests_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'pending'::"text", 'approved'::"text", 'rejected'::"text", 'processing'::"text", 'succeeded'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."refund_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."refund_requests" IS 'Sprint 6 Phase 5 — refund requests (full/partial/manual).';



CREATE TABLE IF NOT EXISTS "public"."region_health" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "region_key" "text" NOT NULL,
    "region_name" "text",
    "provider_density" integer DEFAULT 0 NOT NULL,
    "demand_count" integer DEFAULT 0 NOT NULL,
    "avg_response_hours" numeric(10,2),
    "complaint_rate" numeric(8,4),
    "trust_distribution" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "booking_count" integer DEFAULT 0 NOT NULL,
    "health_score" numeric(8,4) DEFAULT 0 NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."region_health" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_ai_analysis" (
    "review_id" "uuid" NOT NULL,
    "short_summary" "text",
    "sentiment" "text",
    "topics" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "positive_highlights" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "improvement_suggestions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "language_detected" "text",
    "translation_ready" boolean DEFAULT false NOT NULL,
    "fake_risk_score" numeric(5,4) DEFAULT 0 NOT NULL,
    "fake_signals" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "model_version" "text" DEFAULT 'heuristic-v1'::"text" NOT NULL,
    "analyzed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "review_ai_analysis_sentiment_check" CHECK ((("sentiment" IS NULL) OR ("sentiment" = ANY (ARRAY['positive'::"text", 'neutral'::"text", 'negative'::"text", 'mixed'::"text"]))))
);


ALTER TABLE "public"."review_ai_analysis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "flag_type" "text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "source" "text" DEFAULT 'ai'::"text" NOT NULL,
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "review_flags_flag_type_check" CHECK (("flag_type" = ANY (ARRAY['spam'::"text", 'repeated'::"text", 'copied'::"text", 'offensive'::"text", 'mass'::"text", 'bot'::"text", 'booking_conflict'::"text", 'fake_suspected'::"text", 'other'::"text"]))),
    CONSTRAINT "review_flags_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "review_flags_source_check" CHECK (("source" = ANY (ARRAY['ai'::"text", 'user'::"text", 'admin'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."review_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_review_helpful_votes" (
    "review_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."service_review_helpful_votes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."review_helpfulness" AS
 SELECT "review_id",
    "user_id",
    "created_at"
   FROM "public"."service_review_helpful_votes";


ALTER VIEW "public"."review_helpfulness" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "media_kind" "text" DEFAULT 'completed'::"text" NOT NULL,
    "bucket" "text" DEFAULT 'service-request-media'::"text" NOT NULL,
    "path" "text" NOT NULL,
    "mime_type" "text",
    "size_bytes" integer,
    "sort_order" smallint DEFAULT 0 NOT NULL,
    "moderation_status" "text" DEFAULT 'approved'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "review_media_media_kind_check" CHECK (("media_kind" = ANY (ARRAY['before'::"text", 'after'::"text", 'completed'::"text", 'general'::"text", 'video'::"text"]))),
    CONSTRAINT "review_media_moderation_status_check" CHECK (("moderation_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'hidden'::"text"])))
);


ALTER TABLE "public"."review_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_moderation" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "actor_id" "uuid",
    "note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "review_moderation_action_check" CHECK (("action" = ANY (ARRAY['hide'::"text", 'restore'::"text", 'delete'::"text", 'approve'::"text", 'reject'::"text", 'flag_reviewed'::"text", 'merge'::"text", 'media_moderate'::"text", 'delete_request'::"text"])))
);


ALTER TABLE "public"."review_moderation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "dimension" "text" NOT NULL,
    "score" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "review_ratings_dimension_check" CHECK (("dimension" = ANY (ARRAY['overall'::"text", 'communication'::"text", 'quality'::"text", 'punctuality'::"text", 'professionalism'::"text", 'value'::"text"]))),
    CONSTRAINT "review_ratings_score_check" CHECK ((("score" >= 1) AND ("score" <= 5)))
);


ALTER TABLE "public"."review_ratings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone,
    "pinned_by_admin" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."review_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_settings" (
    "id" "text" DEFAULT 'default'::"text" NOT NULL,
    "edit_window_days" integer DEFAULT 14 NOT NULL,
    "block_on_high_fake_risk" boolean DEFAULT true NOT NULL,
    "fake_risk_threshold" numeric(5,4) DEFAULT 0.72 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."review_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."risk_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rule_key" "text" NOT NULL,
    "category" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "weight" numeric(8,4) DEFAULT 1.0 NOT NULL,
    "threshold" numeric(8,4) DEFAULT 0.5 NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "ml_ready" boolean DEFAULT false NOT NULL,
    "auto_actions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "risk_rules_category_check" CHECK (("category" = ANY (ARRAY['identity'::"text", 'payment'::"text", 'review'::"text", 'booking'::"text", 'messaging'::"text", 'device'::"text", 'location'::"text", 'policy'::"text", 'ml'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."risk_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."risk_score_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "from_score" numeric(8,4),
    "to_score" numeric(8,4) NOT NULL,
    "from_level" "text",
    "to_level" "text" NOT NULL,
    "triggered_rules" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "actor_id" "uuid",
    "actor_role" "text",
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."risk_score_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."risk_score_history" IS 'Immutable audit trail of risk score changes.';



CREATE TABLE IF NOT EXISTS "public"."risk_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "internal_score" numeric(8,4) DEFAULT 0 NOT NULL,
    "risk_level" "text" DEFAULT 'low'::"text" NOT NULL,
    "confidence" numeric(5,4) DEFAULT 0.5 NOT NULL,
    "explanation" "text",
    "triggered_rules" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "suggested_action" "text",
    "related_events" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "duplicate_candidates" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "signal_breakdown" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "model_version" "text" DEFAULT 'fraud-rules-v1'::"text" NOT NULL,
    "ml_contribution" numeric(8,4) DEFAULT 0 NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "risk_scores_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['provider'::"text", 'customer'::"text", 'booking'::"text", 'payment'::"text", 'review'::"text", 'case'::"text", 'account'::"text"]))),
    CONSTRAINT "risk_scores_internal_score_check" CHECK ((("internal_score" >= (0)::numeric) AND ("internal_score" <= (100)::numeric))),
    CONSTRAINT "risk_scores_risk_level_check" CHECK (("risk_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."risk_scores" OWNER TO "postgres";


COMMENT ON TABLE "public"."risk_scores" IS 'Internal risk scores — never expose to customers.';



CREATE TABLE IF NOT EXISTS "public"."route_optimization_cache" (
    "cache_key" "text" NOT NULL,
    "provider_id" "uuid",
    "route_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "total_distance_km" numeric(10,2),
    "total_travel_min" numeric(10,2),
    "algorithm_version" "text" DEFAULT 'schedule-v1'::"text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."route_optimization_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_experiments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "experiment_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "algorithm_a" "text" DEFAULT 'schedule-v1'::"text" NOT NULL,
    "algorithm_b" "text" DEFAULT 'schedule-ml-v0'::"text" NOT NULL,
    "traffic_b_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT false NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "schedule_experiments_traffic_b_pct_check" CHECK ((("traffic_b_pct" >= (0)::numeric) AND ("traffic_b_pct" <= (100)::numeric)))
);


ALTER TABLE "public"."schedule_experiments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_explanations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "history_id" "uuid",
    "code" "text" NOT NULL,
    "label_en" "text" NOT NULL,
    "label_ar" "text",
    "audience" "text" DEFAULT 'public'::"text" NOT NULL,
    "params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "schedule_explanations_audience_check" CHECK (("audience" = ANY (ARRAY['public'::"text", 'provider'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."schedule_explanations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid",
    "profile_key" "text" DEFAULT 'balanced-v1'::"text" NOT NULL,
    "algorithm_version" "text" DEFAULT 'schedule-v1'::"text" NOT NULL,
    "experiment_id" "text",
    "schedule_date" "date",
    "utilization" numeric(8,4),
    "travel_minutes" numeric(10,2),
    "idle_minutes" numeric(10,2),
    "revenue_forecast" numeric(14,2),
    "burnout_risk" numeric(8,4),
    "opportunity_score" numeric(8,4),
    "signal_breakdown" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "optimized_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "latency_ms" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."schedule_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."schedule_history" IS 'Sprint 8 Phase 4 — AI schedule optimizations (advisory only).';



CREATE TABLE IF NOT EXISTS "public"."schedule_profiles" (
    "profile_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "optimization_goal" "text" DEFAULT 'balanced'::"text" NOT NULL,
    "signal_weights" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "ml_ready" boolean DEFAULT false NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "schedule_profiles_optimization_goal_check" CHECK (("optimization_goal" = ANY (ARRAY['balanced'::"text", 'min_travel'::"text", 'max_utilization'::"text", 'max_revenue'::"text", 'low_fatigue'::"text"])))
);


ALTER TABLE "public"."schedule_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_recommendations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "history_id" "uuid",
    "provider_id" "uuid",
    "kind" "text" NOT NULL,
    "title_en" "text" NOT NULL,
    "title_ar" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "score" numeric(8,4),
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "decided_at" timestamp with time zone,
    CONSTRAINT "schedule_recommendations_kind_check" CHECK (("kind" = ANY (ARRAY['day_optimize'::"text", 'gap_fill'::"text", 'route'::"text", 'opportunity'::"text", 'capacity'::"text", 'other'::"text"]))),
    CONSTRAINT "schedule_recommendations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."schedule_recommendations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_signal_weights" (
    "signal_key" "text" NOT NULL,
    "category" "text" NOT NULL,
    "weight" numeric(8,4) DEFAULT 1.0 NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "ml_ready" boolean DEFAULT false NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "schedule_signal_weights_category_check" CHECK (("category" = ANY (ARRAY['bookings'::"text", 'travel'::"text", 'time'::"text", 'capacity'::"text", 'job'::"text", 'customer'::"text", 'quality'::"text", 'risk'::"text", 'ml'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."schedule_signal_weights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."search_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "query_text" "text" NOT NULL,
    "normalized_query" "text",
    "problem_id" character varying(80),
    "category_slug" character varying(80),
    "city_slug" character varying(80),
    "priority" "public"."problem_priority",
    "result_count" smallint DEFAULT 0 NOT NULL,
    "provider_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "locale" character varying(10),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nearby_radius" character varying(16),
    "ranking_snapshot" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "input_mode" "text",
    "voice_language" "text",
    CONSTRAINT "search_logs_input_mode_check" CHECK ((("input_mode" IS NULL) OR ("input_mode" = ANY (ARRAY['text'::"text", 'voice'::"text"]))))
);


ALTER TABLE "public"."search_logs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."search_logs"."ranking_snapshot" IS 'Ordered candidates with factor scores for growth-potential re-ranking. Never stores customer GPS.';



CREATE TABLE IF NOT EXISTS "public"."service_projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "root_service_request_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'planning'::"text" NOT NULL,
    "city_id" "uuid",
    "urgency" "text",
    "completion_pct" integer DEFAULT 0 NOT NULL,
    "estimated_days_min" integer,
    "estimated_days_max" integer,
    "actual_duration_days" numeric,
    "plan_version" integer DEFAULT 1 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "service_projects_completion_pct_check" CHECK ((("completion_pct" >= 0) AND ("completion_pct" <= 100))),
    CONSTRAINT "service_projects_status_check" CHECK (("status" = ANY (ARRAY['detected'::"text", 'planning'::"text", 'offers'::"text", 'booked'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."service_projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_request_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "bucket" character varying(100) DEFAULT 'service-request-media'::character varying NOT NULL,
    "path" "text" NOT NULL,
    "mime_type" character varying(100),
    "size_bytes" integer,
    "sort_order" smallint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."service_request_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "provider_id" "uuid",
    "title" character varying(200) NOT NULL,
    "description" "text" NOT NULL,
    "preferred_date" "date",
    "preferred_time" time without time zone,
    "budget" numeric(12,2),
    "location_text" "text",
    "status" "public"."service_request_status" DEFAULT 'pending'::"public"."service_request_status" NOT NULL,
    "accepted_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "quoted_at" timestamp with time zone,
    "quote_accepted_at" timestamp with time zone,
    "quote_declined_at" timestamp with time zone,
    "in_progress_at" timestamp with time zone,
    "completed_by_business_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "reviewed_at" timestamp with time zone,
    "disputed_at" timestamp with time zone,
    "dispute_note" "text",
    "response_time_seconds" integer,
    "completion_time_seconds" integer,
    "currency" character varying(8) DEFAULT 'SYP'::character varying,
    "lifecycle_version" smallint DEFAULT 1 NOT NULL,
    "selection_id" "uuid",
    "category_id" "uuid",
    "urgency" "text",
    "city_id" "uuid",
    "intent_text" "text",
    "category_confirmed" boolean DEFAULT false NOT NULL,
    "published_at" timestamp with time zone,
    CONSTRAINT "service_requests_budget_nonneg" CHECK ((("budget" IS NULL) OR ("budget" >= (0)::numeric))),
    CONSTRAINT "service_requests_provider_lifecycle_chk" CHECK ((((COALESCE(("lifecycle_version")::integer, 1) = 1) AND ("provider_id" IS NOT NULL)) OR (COALESCE(("lifecycle_version")::integer, 1) >= 2))),
    CONSTRAINT "service_requests_urgency_check" CHECK ((("urgency" IS NULL) OR ("urgency" = ANY (ARRAY['emergency'::"text", 'normal'::"text"]))))
);


ALTER TABLE "public"."service_requests" OWNER TO "postgres";


COMMENT ON COLUMN "public"."service_requests"."lifecycle_version" IS 'Dalily 2.0: 1=legacy RFQ row, 2=marketplace-native (future). Sprint 1 additive.';



COMMENT ON COLUMN "public"."service_requests"."selection_id" IS 'Dalily 2.0: FK placeholder to marketplace_selections (Sprint 4/5). Nullable until unlock flow.';



COMMENT ON COLUMN "public"."service_requests"."category_id" IS 'Confirmed category for matching (Sprint 3).';



COMMENT ON COLUMN "public"."service_requests"."urgency" IS 'emergency | normal — auto-classified then confirmed when emergency hypothesized.';



COMMENT ON COLUMN "public"."service_requests"."intent_text" IS 'Dalily 2.0 customer intent (Sprint 2). May mirror description.';



CREATE TABLE IF NOT EXISTS "public"."service_review_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "bucket" character varying(100) DEFAULT 'service-request-media'::character varying NOT NULL,
    "path" "text" NOT NULL,
    "mime_type" character varying(100),
    "size_bytes" integer,
    "sort_order" smallint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "media_kind" "text",
    CONSTRAINT "service_review_images_media_kind_check" CHECK ((("media_kind" IS NULL) OR ("media_kind" = ANY (ARRAY['before'::"text", 'after'::"text", 'completed'::"text", 'general'::"text", 'video'::"text"]))))
);


ALTER TABLE "public"."service_review_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."smart_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "event_key" "text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "ai_suggested_priority" "text",
    "title_en" "text" NOT NULL,
    "title_ar" "text" NOT NULL,
    "body_en" "text" NOT NULL,
    "body_ar" "text" NOT NULL,
    "href" "text",
    "action_key" "text",
    "action_label_en" "text",
    "action_label_ar" "text",
    "action_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "group_key" "text",
    "group_id" "uuid",
    "is_group_summary" boolean DEFAULT false NOT NULL,
    "group_count" integer DEFAULT 1 NOT NULL,
    "source_table" "text",
    "source_id" "uuid",
    "marketplace_notification_id" "uuid",
    "status" "text" DEFAULT 'unread'::"text" NOT NULL,
    "read_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "dismissed_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "smart_notifications_ai_suggested_priority_check" CHECK ((("ai_suggested_priority" IS NULL) OR ("ai_suggested_priority" = ANY (ARRAY['critical'::"text", 'high'::"text", 'normal'::"text", 'low'::"text"])))),
    CONSTRAINT "smart_notifications_category_check" CHECK (("category" = ANY (ARRAY['marketplace'::"text", 'bookings'::"text", 'emergency'::"text", 'projects'::"text", 'messages'::"text", 'voice'::"text", 'tasks'::"text", 'approvals'::"text", 'recurring'::"text", 'invoices'::"text", 'payments'::"text", 'admin'::"text", 'system'::"text"]))),
    CONSTRAINT "smart_notifications_priority_check" CHECK (("priority" = ANY (ARRAY['critical'::"text", 'high'::"text", 'normal'::"text", 'low'::"text"]))),
    CONSTRAINT "smart_notifications_status_check" CHECK (("status" = ANY (ARRAY['unread'::"text", 'read'::"text", 'archived'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."smart_notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."smart_notifications" IS 'Sprint 5 Phase 6 — unified smart notification center. AI may suggest priority only.';



CREATE TABLE IF NOT EXISTS "public"."subscription_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" character varying(40) NOT NULL,
    "name" "jsonb" NOT NULL,
    "monthly_price_usd" numeric(10,2) DEFAULT 0 NOT NULL,
    "yearly_price_usd" numeric(10,2) DEFAULT 0 NOT NULL,
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscription_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" "public"."subscription_status" DEFAULT 'active'::"public"."subscription_status" NOT NULL,
    "starts_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "auto_renew" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unlock_reliability_signals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unlock_session_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "signal_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "unlock_reliability_signals_signal_type_check" CHECK (("signal_type" = ANY (ARRAY['declined'::"text", 'timed_out'::"text"])))
);


ALTER TABLE "public"."unlock_reliability_signals" OWNER TO "postgres";


COMMENT ON TABLE "public"."unlock_reliability_signals" IS 'Hook for future reputation (Sprint 5). No scoring compute here.';



CREATE TABLE IF NOT EXISTS "public"."unlock_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "selection_id" "uuid" NOT NULL,
    "service_request_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "offer_id" "uuid",
    "status" "text" DEFAULT 'opened'::"text" NOT NULL,
    "fee_amount" numeric(12,2) NOT NULL,
    "fee_currency" "text" DEFAULT 'SYP'::"text" NOT NULL,
    "sla_deadline" timestamp with time zone NOT NULL,
    "fallback_applied" boolean DEFAULT false NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "payment_stub_ref" "text",
    "opened_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    "payment_id" "uuid",
    "admin_comp_reason" "text",
    "pricing_history_id" "uuid",
    "unlock_method" "text",
    "ai_price_usd" numeric(10,2),
    "ai_score" numeric(8,4),
    "pricing_explanation_en" "text",
    "pricing_explanation_ar" "text",
    CONSTRAINT "unlock_sessions_status_check" CHECK (("status" = ANY (ARRAY['opened'::"text", 'payment_pending'::"text", 'succeeded'::"text", 'declined'::"text", 'timed_out'::"text"]))),
    CONSTRAINT "unlock_sessions_unlock_method_check" CHECK ((("unlock_method" IS NULL) OR ("unlock_method" = ANY (ARRAY['included'::"text", 'pay_per_lead'::"text", 'dev_bypass'::"text", 'admin'::"text", 'legacy'::"text"]))))
);


ALTER TABLE "public"."unlock_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."unlock_sessions" IS 'Dalily 2.0 Unlock Service — SLA + fee snapshot per selection (Sprint 5).';



COMMENT ON COLUMN "public"."unlock_sessions"."admin_comp_reason" IS 'Sprint 9: set when grant issued via audited admin_comp (reason required in action log).';



CREATE TABLE IF NOT EXISTS "public"."user_presence" (
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'offline'::"text" NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_presence_status_check" CHECK (("status" = ANY (ARRAY['online'::"text", 'offline'::"text"])))
);


ALTER TABLE "public"."user_presence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "granted_by" "uuid",
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_storage_usage" (
    "user_id" "uuid" NOT NULL,
    "bytes_used" bigint DEFAULT 0 NOT NULL,
    "file_count" integer DEFAULT 0 NOT NULL,
    "deleted_bytes" bigint DEFAULT 0 NOT NULL,
    "deleted_file_count" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_storage_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "phone" character varying(20),
    "phone_verified_at" timestamp with time zone,
    "email_verified_at" timestamp with time zone,
    "status" "public"."user_status" DEFAULT 'active'::"public"."user_status" NOT NULL,
    "last_login_at" timestamp with time zone,
    "preferred_locale" character varying(5) DEFAULT 'ar'::character varying NOT NULL,
    "preferred_city_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."verification_levels" (
    "slug" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "accent" "text" DEFAULT 'green'::"text" NOT NULL,
    "label_key" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "name_ar" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "verification_levels_accent_check" CHECK (("accent" = ANY (ARRAY['green'::"text", 'blue'::"text", 'purple'::"text", 'gold'::"text", 'navy'::"text"])))
);


ALTER TABLE "public"."verification_levels" OWNER TO "postgres";


COMMENT ON TABLE "public"."verification_levels" IS 'Public verification levels catalog (basic/business/professional). Extensible.';



CREATE TABLE IF NOT EXISTS "public"."verification_types" (
    "slug" "text" NOT NULL,
    "level_slug" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "label_key" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "name_ar" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."verification_types" OWNER TO "postgres";


COMMENT ON TABLE "public"."verification_types" IS 'Public verification type catalog. New rows appear in the public panel automatically.';



ALTER TABLE ONLY "public"."admin_action_logs"
    ADD CONSTRAINT "admin_action_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_broadcasts"
    ADD CONSTRAINT "admin_broadcasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_assistant_contexts"
    ADD CONSTRAINT "ai_assistant_contexts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_assistant_contexts"
    ADD CONSTRAINT "ai_assistant_contexts_request_audience_unique" UNIQUE ("service_request_id", "audience");



ALTER TABLE ONLY "public"."ai_automation_actions"
    ADD CONSTRAINT "ai_automation_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_automation_approvals"
    ADD CONSTRAINT "ai_automation_approvals_action_unique" UNIQUE ("action_id");



ALTER TABLE ONLY "public"."ai_automation_approvals"
    ADD CONSTRAINT "ai_automation_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_automation_feedback"
    ADD CONSTRAINT "ai_automation_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_automation_policies"
    ADD CONSTRAINT "ai_automation_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_automation_policies"
    ADD CONSTRAINT "ai_automation_policies_policy_key_key" UNIQUE ("policy_key");



ALTER TABLE ONLY "public"."ai_availability_forecasts"
    ADD CONSTRAINT "ai_availability_forecasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_availability_forecasts"
    ADD CONSTRAINT "ai_availability_forecasts_unique" UNIQUE ("provider_id", "forecast_date");



ALTER TABLE ONLY "public"."ai_chat_action_items"
    ADD CONSTRAINT "ai_chat_action_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_chat_extractions"
    ADD CONSTRAINT "ai_chat_extractions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_chat_preferences"
    ADD CONSTRAINT "ai_chat_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."ai_chat_sentiment"
    ADD CONSTRAINT "ai_chat_sentiment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_chat_translations"
    ADD CONSTRAINT "ai_chat_translations_message_id_target_lang_key" UNIQUE ("message_id", "target_lang");



ALTER TABLE ONLY "public"."ai_chat_translations"
    ADD CONSTRAINT "ai_chat_translations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_conversation_summaries"
    ADD CONSTRAINT "ai_conversation_summaries_hash_unique" UNIQUE ("conversation_id", "audience", "source_hash");



ALTER TABLE ONLY "public"."ai_conversation_summaries"
    ADD CONSTRAINT "ai_conversation_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_demand_forecasts"
    ADD CONSTRAINT "ai_demand_forecasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_demand_forecasts"
    ADD CONSTRAINT "ai_demand_forecasts_unique" UNIQUE NULLS NOT DISTINCT ("forecast_date", "hour_bucket", "city_id", "category_slug", "model_version");



ALTER TABLE ONLY "public"."ai_dispatch_predictions"
    ADD CONSTRAINT "ai_dispatch_predictions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_intent_decisions"
    ADD CONSTRAINT "ai_intent_decisions_norm_lang" UNIQUE ("normalized_text", "language");



ALTER TABLE ONLY "public"."ai_intent_decisions"
    ADD CONSTRAINT "ai_intent_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_intent_memory"
    ADD CONSTRAINT "ai_intent_memory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_job_analyses"
    ADD CONSTRAINT "ai_job_analyses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_knowledge_phrases"
    ADD CONSTRAINT "ai_knowledge_phrases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_knowledge_phrases"
    ADD CONSTRAINT "ai_knowledge_phrases_unique" UNIQUE ("normalized_phrase", "category_slug", "language");



ALTER TABLE ONLY "public"."ai_marketplace_balances"
    ADD CONSTRAINT "ai_marketplace_balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_marketplace_path_stats"
    ADD CONSTRAINT "ai_marketplace_path_stats_path_unique" UNIQUE ("path");



ALTER TABLE ONLY "public"."ai_marketplace_path_stats"
    ADD CONSTRAINT "ai_marketplace_path_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_offer_comparisons"
    ADD CONSTRAINT "ai_offer_comparisons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_prediction_outcomes"
    ADD CONSTRAINT "ai_prediction_outcomes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_predictive_notifications"
    ADD CONSTRAINT "ai_predictive_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_proactive_suggestions"
    ADD CONSTRAINT "ai_proactive_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_provider_automation_settings"
    ADD CONSTRAINT "ai_provider_automation_settings_pkey" PRIMARY KEY ("provider_id");



ALTER TABLE ONLY "public"."ai_provider_reputation"
    ADD CONSTRAINT "ai_provider_reputation_pkey" PRIMARY KEY ("provider_id");



ALTER TABLE ONLY "public"."ai_service_knowledge"
    ADD CONSTRAINT "ai_service_knowledge_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_service_knowledge"
    ADD CONSTRAINT "ai_service_knowledge_service_key_key" UNIQUE ("service_key");



ALTER TABLE ONLY "public"."ai_vision_analyses"
    ADD CONSTRAINT "ai_vision_analyses_hash_unique" UNIQUE ("content_hash");



ALTER TABLE ONLY "public"."ai_vision_analyses"
    ADD CONSTRAINT "ai_vision_analyses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_voice_transcripts"
    ADD CONSTRAINT "ai_voice_transcripts_hash_unique" UNIQUE ("content_hash");



ALTER TABLE ONLY "public"."ai_voice_transcripts"
    ADD CONSTRAINT "ai_voice_transcripts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_wait_time_estimates"
    ADD CONSTRAINT "ai_wait_time_estimates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_wait_time_estimates"
    ADD CONSTRAINT "ai_wait_time_estimates_unique" UNIQUE NULLS NOT DISTINCT ("category_slug", "city_id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_analytics_events"
    ADD CONSTRAINT "booking_analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_attachments"
    ADD CONSTRAINT "booking_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_issue_reports"
    ADD CONSTRAINT "booking_issue_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_notes"
    ADD CONSTRAINT "booking_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_reminder_log"
    ADD CONSTRAINT "booking_reminder_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_slot_feedback"
    ADD CONSTRAINT "booking_slot_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_status_log"
    ADD CONSTRAINT "booking_status_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_assistant_experiments"
    ADD CONSTRAINT "business_assistant_experiments_experiment_key_key" UNIQUE ("experiment_key");



ALTER TABLE ONLY "public"."business_assistant_experiments"
    ADD CONSTRAINT "business_assistant_experiments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_benchmarks"
    ADD CONSTRAINT "business_benchmarks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_benchmarks"
    ADD CONSTRAINT "business_benchmarks_provider_id_region_key_category_key_key" UNIQUE ("provider_id", "region_key", "category_key");



ALTER TABLE ONLY "public"."business_briefings"
    ADD CONSTRAINT "business_briefings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_briefings"
    ADD CONSTRAINT "business_briefings_provider_id_briefing_date_key" UNIQUE ("provider_id", "briefing_date");



ALTER TABLE ONLY "public"."business_goal_progress"
    ADD CONSTRAINT "business_goal_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_goals"
    ADD CONSTRAINT "business_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_health"
    ADD CONSTRAINT "business_health_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_health"
    ADD CONSTRAINT "business_health_provider_id_key" UNIQUE ("provider_id");



ALTER TABLE ONLY "public"."business_insights"
    ADD CONSTRAINT "business_insights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_recommendations"
    ADD CONSTRAINT "business_recommendations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_subscription_payments"
    ADD CONSTRAINT "business_subscription_payments_payment_id_key" UNIQUE ("payment_id");



ALTER TABLE ONLY "public"."business_subscription_payments"
    ADD CONSTRAINT "business_subscription_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."capacity_history"
    ADD CONSTRAINT "capacity_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."capacity_predictions"
    ADD CONSTRAINT "capacity_predictions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_module_id_slug_key" UNIQUE ("module_id", "slug");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category_health"
    ADD CONSTRAINT "category_health_category_id_key" UNIQUE ("category_id");



ALTER TABLE ONLY "public"."category_health"
    ADD CONSTRAINT "category_health_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cell_policies"
    ADD CONSTRAINT "cell_policies_pkey" PRIMARY KEY ("cell_key");



ALTER TABLE ONLY "public"."chat_analytics_events"
    ADD CONSTRAINT "chat_analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_voice_transcript_translations"
    ADD CONSTRAINT "chat_voice_transcript_translation_transcript_id_target_lang_key" UNIQUE ("transcript_id", "target_lang");



ALTER TABLE ONLY "public"."chat_voice_transcript_translations"
    ADD CONSTRAINT "chat_voice_transcript_translations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_voice_transcripts"
    ADD CONSTRAINT "chat_voice_transcripts_message_id_key" UNIQUE ("message_id");



ALTER TABLE ONLY "public"."chat_voice_transcripts"
    ADD CONSTRAINT "chat_voice_transcripts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."company_billing_settings"
    ADD CONSTRAINT "company_billing_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_release_grants"
    ADD CONSTRAINT "contact_release_grants_one_active_per_request" UNIQUE ("service_request_id");



ALTER TABLE ONLY "public"."contact_release_grants"
    ADD CONSTRAINT "contact_release_grants_one_per_session" UNIQUE ("unlock_session_id");



ALTER TABLE ONLY "public"."contact_release_grants"
    ADD CONSTRAINT "contact_release_grants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_conversation_id_user_id_key" UNIQUE ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_typing"
    ADD CONSTRAINT "conversation_typing_pkey" PRIMARY KEY ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_service_request_id_key" UNIQUE ("service_request_id");



ALTER TABLE ONLY "public"."credit_note_metadata"
    ADD CONSTRAINT "credit_note_metadata_pkey" PRIMARY KEY ("document_id");



ALTER TABLE ONLY "public"."customer_preference_profiles"
    ADD CONSTRAINT "customer_preference_profiles_pkey" PRIMARY KEY ("customer_id");



ALTER TABLE ONLY "public"."customer_preferences"
    ADD CONSTRAINT "customer_preferences_pkey" PRIMARY KEY ("customer_id");



ALTER TABLE ONLY "public"."dispute_evidence"
    ADD CONSTRAINT "dispute_evidence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_download_history"
    ADD CONSTRAINT "document_download_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_number_sequences"
    ADD CONSTRAINT "document_number_sequences_pkey" PRIMARY KEY ("prefix", "year");



ALTER TABLE ONLY "public"."emergency_dispatch_responses"
    ADD CONSTRAINT "emergency_dispatch_responses_dispatch_id_provider_id_respon_key" UNIQUE ("dispatch_id", "provider_id", "response");



ALTER TABLE ONLY "public"."emergency_dispatch_responses"
    ADD CONSTRAINT "emergency_dispatch_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emergency_dispatches"
    ADD CONSTRAINT "emergency_dispatches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emergency_dispatches"
    ADD CONSTRAINT "emergency_dispatches_service_request_id_key" UNIQUE ("service_request_id");



ALTER TABLE ONLY "public"."emergency_live_locations"
    ADD CONSTRAINT "emergency_live_locations_dispatch_id_provider_id_key" UNIQUE ("dispatch_id", "provider_id");



ALTER TABLE ONLY "public"."emergency_live_locations"
    ADD CONSTRAINT "emergency_live_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emergency_timeline_events"
    ADD CONSTRAINT "emergency_timeline_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_relationships"
    ADD CONSTRAINT "entity_relationships_from_entity_type_from_entity_id_to_ent_key" UNIQUE ("from_entity_type", "from_entity_id", "to_entity_type", "to_entity_id", "relationship_type");



ALTER TABLE ONLY "public"."entity_relationships"
    ADD CONSTRAINT "entity_relationships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_analytics_cache"
    ADD CONSTRAINT "finance_analytics_cache_pkey" PRIMARY KEY ("cache_key");



ALTER TABLE ONLY "public"."financial_documents"
    ADD CONSTRAINT "financial_documents_document_number_key" UNIQUE ("document_number");



ALTER TABLE ONLY "public"."financial_documents"
    ADD CONSTRAINT "financial_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forecast_accuracy"
    ADD CONSTRAINT "forecast_accuracy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forecast_experiments"
    ADD CONSTRAINT "forecast_experiments_experiment_key_key" UNIQUE ("experiment_key");



ALTER TABLE ONLY "public"."forecast_experiments"
    ADD CONSTRAINT "forecast_experiments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forecast_explanations"
    ADD CONSTRAINT "forecast_explanations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forecast_history"
    ADD CONSTRAINT "forecast_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forecast_market_snapshots"
    ADD CONSTRAINT "forecast_market_snapshots_category_key_region_key_key" UNIQUE ("category_key", "region_key");



ALTER TABLE ONLY "public"."forecast_market_snapshots"
    ADD CONSTRAINT "forecast_market_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forecast_models"
    ADD CONSTRAINT "forecast_models_pkey" PRIMARY KEY ("model_key");



ALTER TABLE ONLY "public"."forecast_results"
    ADD CONSTRAINT "forecast_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forecast_signal_weights"
    ADD CONSTRAINT "forecast_signal_weights_pkey" PRIMARY KEY ("signal_key");



ALTER TABLE ONLY "public"."fraud_events"
    ADD CONSTRAINT "fraud_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."images"
    ADD CONSTRAINT "images_bucket_path_key" UNIQUE ("bucket", "path");



ALTER TABLE ONLY "public"."images"
    ADD CONSTRAINT "images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."investigation_history"
    ADD CONSTRAINT "investigation_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."investigation_notes"
    ADD CONSTRAINT "investigation_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."investigations"
    ADD CONSTRAINT "investigations_case_number_key" UNIQUE ("case_number");



ALTER TABLE ONLY "public"."investigations"
    ADD CONSTRAINT "investigations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_metadata"
    ADD CONSTRAINT "invoice_metadata_pkey" PRIMARY KEY ("document_id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_pricing_history"
    ADD CONSTRAINT "lead_pricing_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_unlock_payments"
    ADD CONSTRAINT "lead_unlock_payments_payment_id_key" UNIQUE ("payment_id");



ALTER TABLE ONLY "public"."lead_unlock_payments"
    ADD CONSTRAINT "lead_unlock_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learning_events"
    ADD CONSTRAINT "learning_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."maintenance_contracts"
    ADD CONSTRAINT "maintenance_contracts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."maintenance_contracts"
    ADD CONSTRAINT "maintenance_contracts_plan_id_key" UNIQUE ("plan_id");



ALTER TABLE ONLY "public"."marketplace_algorithm_versions"
    ADD CONSTRAINT "marketplace_algorithm_versions_module_key_algorithm_version_key" UNIQUE ("module_key", "algorithm_version");



ALTER TABLE ONLY "public"."marketplace_algorithm_versions"
    ADD CONSTRAINT "marketplace_algorithm_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_category_metrics"
    ADD CONSTRAINT "marketplace_category_metrics_category_key_key" UNIQUE ("category_key");



ALTER TABLE ONLY "public"."marketplace_category_metrics"
    ADD CONSTRAINT "marketplace_category_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_decisions"
    ADD CONSTRAINT "marketplace_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_executive_reports"
    ADD CONSTRAINT "marketplace_executive_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_heatmaps"
    ADD CONSTRAINT "marketplace_heatmaps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_heatmaps"
    ADD CONSTRAINT "marketplace_heatmaps_region_key_metric_key_key" UNIQUE ("region_key", "metric_key");



ALTER TABLE ONLY "public"."marketplace_intelligence"
    ADD CONSTRAINT "marketplace_intelligence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_intelligence"
    ADD CONSTRAINT "marketplace_intelligence_snapshot_key_key" UNIQUE ("snapshot_key");



ALTER TABLE ONLY "public"."marketplace_knowledge_graph"
    ADD CONSTRAINT "marketplace_knowledge_graph_node_type_node_key_key" UNIQUE ("node_type", "node_key");



ALTER TABLE ONLY "public"."marketplace_knowledge_graph"
    ADD CONSTRAINT "marketplace_knowledge_graph_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_notifications"
    ADD CONSTRAINT "marketplace_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_offers"
    ADD CONSTRAINT "marketplace_offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_offers"
    ADD CONSTRAINT "marketplace_offers_unique_assignment" UNIQUE ("match_assignment_id");



ALTER TABLE ONLY "public"."marketplace_opportunities"
    ADD CONSTRAINT "marketplace_opportunities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_recommendations"
    ADD CONSTRAINT "marketplace_recommendations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_region_metrics"
    ADD CONSTRAINT "marketplace_region_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_region_metrics"
    ADD CONSTRAINT "marketplace_region_metrics_region_key_key" UNIQUE ("region_key");



ALTER TABLE ONLY "public"."marketplace_reports"
    ADD CONSTRAINT "marketplace_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_request_projections"
    ADD CONSTRAINT "marketplace_request_projections_pkey" PRIMARY KEY ("service_request_id");



ALTER TABLE ONLY "public"."marketplace_selections"
    ADD CONSTRAINT "marketplace_selections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_simulations"
    ADD CONSTRAINT "marketplace_simulations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_assignments"
    ADD CONSTRAINT "match_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_assignments"
    ADD CONSTRAINT "match_assignments_unique_provider" UNIQUE ("service_request_id", "provider_id");



ALTER TABLE ONLY "public"."match_pools"
    ADD CONSTRAINT "match_pools_one_per_request" UNIQUE ("service_request_id");



ALTER TABLE ONLY "public"."match_pools"
    ADD CONSTRAINT "match_pools_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matching_experiments"
    ADD CONSTRAINT "matching_experiments_experiment_key_key" UNIQUE ("experiment_key");



ALTER TABLE ONLY "public"."matching_experiments"
    ADD CONSTRAINT "matching_experiments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matching_explanations"
    ADD CONSTRAINT "matching_explanations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matching_fairness_state"
    ADD CONSTRAINT "matching_fairness_state_pkey" PRIMARY KEY ("provider_id");



ALTER TABLE ONLY "public"."matching_feedback"
    ADD CONSTRAINT "matching_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matching_history"
    ADD CONSTRAINT "matching_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matching_scores"
    ADD CONSTRAINT "matching_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matching_weights"
    ADD CONSTRAINT "matching_weights_pkey" PRIMARY KEY ("signal_key");



ALTER TABLE ONLY "public"."media_objects"
    ADD CONSTRAINT "media_objects_bucket_path_key" UNIQUE ("bucket", "path");



ALTER TABLE ONLY "public"."media_objects"
    ADD CONSTRAINT "media_objects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_processing_jobs"
    ADD CONSTRAINT "media_processing_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_attachments"
    ADD CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_read_receipts"
    ADD CONSTRAINT "message_read_receipts_pkey" PRIMARY KEY ("message_id", "user_id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."monetization_audit_logs"
    ADD CONSTRAINT "monetization_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monetization_billing_settings"
    ADD CONSTRAINT "monetization_billing_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_delivery_attempts"
    ADD CONSTRAINT "notification_delivery_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_digests"
    ADD CONSTRAINT "notification_digests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."notification_push_subscriptions"
    ADD CONSTRAINT "notification_push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_push_subscriptions"
    ADD CONSTRAINT "notification_push_subscriptions_user_id_endpoint_key" UNIQUE ("user_id", "endpoint");



ALTER TABLE ONLY "public"."offer_clarifications"
    ADD CONSTRAINT "offer_clarifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offer_templates"
    ADD CONSTRAINT "offer_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_disputes"
    ADD CONSTRAINT "payment_disputes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_disputes"
    ADD CONSTRAINT "payment_disputes_stripe_dispute_id_key" UNIQUE ("stripe_dispute_id");



ALTER TABLE ONLY "public"."payment_events"
    ADD CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_provider_event_types"
    ADD CONSTRAINT "payment_provider_event_types_pkey" PRIMARY KEY ("event_type");



ALTER TABLE ONLY "public"."payment_status_snapshots"
    ADD CONSTRAINT "payment_status_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_webhook_events"
    ADD CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_webhook_events"
    ADD CONSTRAINT "payment_webhook_events_provider_external_uidx" UNIQUE ("provider", "external_event_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pdf_generation_logs"
    ADD CONSTRAINT "pdf_generation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_alerts"
    ADD CONSTRAINT "platform_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_anomalies"
    ADD CONSTRAINT "platform_anomalies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_health_metrics"
    ADD CONSTRAINT "platform_health_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_ops_audit"
    ADD CONSTRAINT "platform_ops_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_ops_tasks"
    ADD CONSTRAINT "platform_ops_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_trends"
    ADD CONSTRAINT "platform_trends_metric_key_period_period_start_scope_type_s_key" UNIQUE ("metric_key", "period", "period_start", "scope_type", "scope_id");



ALTER TABLE ONLY "public"."platform_trends"
    ADD CONSTRAINT "platform_trends_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_experiments"
    ADD CONSTRAINT "pricing_experiments_experiment_key_key" UNIQUE ("experiment_key");



ALTER TABLE ONLY "public"."pricing_experiments"
    ADD CONSTRAINT "pricing_experiments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_explanations"
    ADD CONSTRAINT "pricing_explanations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_feedback"
    ADD CONSTRAINT "pricing_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_history"
    ADD CONSTRAINT "pricing_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_market_data"
    ADD CONSTRAINT "pricing_market_data_category_key_region_key_currency_key" UNIQUE ("category_key", "region_key", "currency");



ALTER TABLE ONLY "public"."pricing_market_data"
    ADD CONSTRAINT "pricing_market_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_weights"
    ADD CONSTRAINT "pricing_weights_pkey" PRIMARY KEY ("signal_key");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."project_activity_events"
    ADD CONSTRAINT "project_activity_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_approvals"
    ADD CONSTRAINT "project_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_checklist_items"
    ADD CONSTRAINT "project_checklist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_checklist_templates"
    ADD CONSTRAINT "project_checklist_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_checklist_templates"
    ADD CONSTRAINT "project_checklist_templates_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."project_checklists"
    ADD CONSTRAINT "project_checklists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_document_versions"
    ADD CONSTRAINT "project_document_versions_document_id_version_number_key" UNIQUE ("document_id", "version_number");



ALTER TABLE ONLY "public"."project_document_versions"
    ADD CONSTRAINT "project_document_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_documents"
    ADD CONSTRAINT "project_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_packages"
    ADD CONSTRAINT "project_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_packages"
    ADD CONSTRAINT "project_packages_project_id_trade_slug_key" UNIQUE ("project_id", "trade_slug");



ALTER TABLE ONLY "public"."project_tasks"
    ADD CONSTRAINT "project_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_timeline_events"
    ADD CONSTRAINT "project_timeline_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_availability_breaks"
    ADD CONSTRAINT "provider_availability_breaks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_availability_settings"
    ADD CONSTRAINT "provider_availability_settings_pkey" PRIMARY KEY ("provider_id");



ALTER TABLE ONLY "public"."provider_blocked_times"
    ADD CONSTRAINT "provider_blocked_times_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_capacity"
    ADD CONSTRAINT "provider_capacity_pkey" PRIMARY KEY ("provider_id");



ALTER TABLE ONLY "public"."provider_engagement_events"
    ADD CONSTRAINT "provider_engagement_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_monetization_plans"
    ADD CONSTRAINT "provider_monetization_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_monetization_plans"
    ADD CONSTRAINT "provider_monetization_plans_provider_id_key" UNIQUE ("provider_id");



ALTER TABLE ONLY "public"."provider_monthly_unlock_usage"
    ADD CONSTRAINT "provider_monthly_unlock_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_monthly_unlock_usage"
    ADD CONSTRAINT "provider_monthly_unlock_usage_provider_id_period_ym_key" UNIQUE ("provider_id", "period_ym");



ALTER TABLE ONLY "public"."provider_opportunities"
    ADD CONSTRAINT "provider_opportunities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_opportunity_history"
    ADD CONSTRAINT "provider_opportunity_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_performance_scores"
    ADD CONSTRAINT "provider_performance_scores_pkey" PRIMARY KEY ("provider_id");



ALTER TABLE ONLY "public"."provider_reputation_cache"
    ADD CONSTRAINT "provider_reputation_cache_pkey" PRIMARY KEY ("provider_id");



ALTER TABLE ONLY "public"."provider_reputation_events"
    ADD CONSTRAINT "provider_reputation_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_reputation_explanations"
    ADD CONSTRAINT "provider_reputation_explanations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_reputation_history"
    ADD CONSTRAINT "provider_reputation_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_reputation_scores"
    ADD CONSTRAINT "provider_reputation_scores_pkey" PRIMARY KEY ("provider_id");



ALTER TABLE ONLY "public"."provider_reputation_signals"
    ADD CONSTRAINT "provider_reputation_signals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_reputation_signals"
    ADD CONSTRAINT "provider_reputation_signals_provider_id_signal_key_key" UNIQUE ("provider_id", "signal_key");



ALTER TABLE ONLY "public"."provider_reputation_weights"
    ADD CONSTRAINT "provider_reputation_weights_pkey" PRIMARY KEY ("signal_key");



ALTER TABLE ONLY "public"."provider_request_settings"
    ADD CONSTRAINT "provider_request_settings_pkey" PRIMARY KEY ("provider_id");



ALTER TABLE ONLY "public"."provider_routes"
    ADD CONSTRAINT "provider_routes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_schedule_gaps"
    ADD CONSTRAINT "provider_schedule_gaps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_services"
    ADD CONSTRAINT "provider_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_verification_checks"
    ADD CONSTRAINT "provider_verification_checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_verification_checks"
    ADD CONSTRAINT "provider_verification_checks_provider_id_type_slug_key" UNIQUE ("provider_id", "type_slug");



ALTER TABLE ONLY "public"."provider_verifications"
    ADD CONSTRAINT "provider_verifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_verifications"
    ADD CONSTRAINT "provider_verifications_provider_id_key" UNIQUE ("provider_id");



ALTER TABLE ONLY "public"."provider_working_hours"
    ADD CONSTRAINT "provider_working_hours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_working_hours"
    ADD CONSTRAINT "provider_working_hours_provider_id_day_of_week_key" UNIQUE ("provider_id", "day_of_week");



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."quality_case_ai_analysis"
    ADD CONSTRAINT "quality_case_ai_analysis_pkey" PRIMARY KEY ("case_id");



ALTER TABLE ONLY "public"."quality_case_assignments"
    ADD CONSTRAINT "quality_case_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quality_case_evidence"
    ADD CONSTRAINT "quality_case_evidence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quality_case_history"
    ADD CONSTRAINT "quality_case_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quality_case_messages"
    ADD CONSTRAINT "quality_case_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quality_case_metrics"
    ADD CONSTRAINT "quality_case_metrics_pkey" PRIMARY KEY ("provider_id");



ALTER TABLE ONLY "public"."quality_cases"
    ADD CONSTRAINT "quality_cases_case_number_key" UNIQUE ("case_number");



ALTER TABLE ONLY "public"."quality_cases"
    ADD CONSTRAINT "quality_cases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_items"
    ADD CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receipt_metadata"
    ADD CONSTRAINT "receipt_metadata_pkey" PRIMARY KEY ("document_id");



ALTER TABLE ONLY "public"."recurring_plans"
    ADD CONSTRAINT "recurring_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_recommendations"
    ADD CONSTRAINT "recurring_recommendations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_reminder_log"
    ADD CONSTRAINT "recurring_reminder_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_reminder_log"
    ADD CONSTRAINT "recurring_reminder_log_plan_id_visit_id_reminder_type_key" UNIQUE ("plan_id", "visit_id", "reminder_type");



ALTER TABLE ONLY "public"."recurring_visits"
    ADD CONSTRAINT "recurring_visits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."refund_history"
    ADD CONSTRAINT "refund_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."region_health"
    ADD CONSTRAINT "region_health_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."region_health"
    ADD CONSTRAINT "region_health_region_key_key" UNIQUE ("region_key");



ALTER TABLE ONLY "public"."review_ai_analysis"
    ADD CONSTRAINT "review_ai_analysis_pkey" PRIMARY KEY ("review_id");



ALTER TABLE ONLY "public"."review_flags"
    ADD CONSTRAINT "review_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_media"
    ADD CONSTRAINT "review_media_bucket_path_key" UNIQUE ("bucket", "path");



ALTER TABLE ONLY "public"."review_media"
    ADD CONSTRAINT "review_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_moderation"
    ADD CONSTRAINT "review_moderation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_ratings"
    ADD CONSTRAINT "review_ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_ratings"
    ADD CONSTRAINT "review_ratings_review_id_dimension_key" UNIQUE ("review_id", "dimension");



ALTER TABLE ONLY "public"."review_responses"
    ADD CONSTRAINT "review_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_responses"
    ADD CONSTRAINT "review_responses_review_id_key" UNIQUE ("review_id");



ALTER TABLE ONLY "public"."review_settings"
    ADD CONSTRAINT "review_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."risk_rules"
    ADD CONSTRAINT "risk_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."risk_rules"
    ADD CONSTRAINT "risk_rules_rule_key_key" UNIQUE ("rule_key");



ALTER TABLE ONLY "public"."risk_score_history"
    ADD CONSTRAINT "risk_score_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."risk_scores"
    ADD CONSTRAINT "risk_scores_entity_type_entity_id_key" UNIQUE ("entity_type", "entity_id");



ALTER TABLE ONLY "public"."risk_scores"
    ADD CONSTRAINT "risk_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."route_optimization_cache"
    ADD CONSTRAINT "route_optimization_cache_pkey" PRIMARY KEY ("cache_key");



ALTER TABLE ONLY "public"."schedule_experiments"
    ADD CONSTRAINT "schedule_experiments_experiment_key_key" UNIQUE ("experiment_key");



ALTER TABLE ONLY "public"."schedule_experiments"
    ADD CONSTRAINT "schedule_experiments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_explanations"
    ADD CONSTRAINT "schedule_explanations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_history"
    ADD CONSTRAINT "schedule_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_profiles"
    ADD CONSTRAINT "schedule_profiles_pkey" PRIMARY KEY ("profile_key");



ALTER TABLE ONLY "public"."schedule_recommendations"
    ADD CONSTRAINT "schedule_recommendations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_signal_weights"
    ADD CONSTRAINT "schedule_signal_weights_pkey" PRIMARY KEY ("signal_key");



ALTER TABLE ONLY "public"."search_logs"
    ADD CONSTRAINT "search_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_projects"
    ADD CONSTRAINT "service_projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_projects"
    ADD CONSTRAINT "service_projects_root_service_request_id_key" UNIQUE ("root_service_request_id");



ALTER TABLE ONLY "public"."service_request_images"
    ADD CONSTRAINT "service_request_images_bucket_path_key" UNIQUE ("bucket", "path");



ALTER TABLE ONLY "public"."service_request_images"
    ADD CONSTRAINT "service_request_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_review_helpful_votes"
    ADD CONSTRAINT "service_review_helpful_votes_pkey" PRIMARY KEY ("review_id", "user_id");



ALTER TABLE ONLY "public"."service_review_images"
    ADD CONSTRAINT "service_review_images_bucket_path_key" UNIQUE ("bucket", "path");



ALTER TABLE ONLY "public"."service_review_images"
    ADD CONSTRAINT "service_review_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_reviews"
    ADD CONSTRAINT "service_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_reviews"
    ADD CONSTRAINT "service_reviews_service_request_id_key" UNIQUE ("service_request_id");



ALTER TABLE ONLY "public"."smart_notifications"
    ADD CONSTRAINT "smart_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unlock_reliability_signals"
    ADD CONSTRAINT "unlock_reliability_signals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unlock_sessions"
    ADD CONSTRAINT "unlock_sessions_idempotency_unique" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."unlock_sessions"
    ADD CONSTRAINT "unlock_sessions_one_open_per_selection" UNIQUE ("selection_id");



ALTER TABLE ONLY "public"."unlock_sessions"
    ADD CONSTRAINT "unlock_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_presence"
    ADD CONSTRAINT "user_presence_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_storage_usage"
    ADD CONSTRAINT "user_storage_usage_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."verification_levels"
    ADD CONSTRAINT "verification_levels_pkey" PRIMARY KEY ("slug");



ALTER TABLE ONLY "public"."verification_types"
    ADD CONSTRAINT "verification_types_pkey" PRIMARY KEY ("slug");



CREATE INDEX "admin_action_logs_action_idx" ON "public"."admin_action_logs" USING "btree" ("action", "created_at" DESC);



CREATE INDEX "admin_action_logs_created_idx" ON "public"."admin_action_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "admin_broadcasts_created_idx" ON "public"."admin_broadcasts" USING "btree" ("created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "ai_assistant_contexts_request_idx" ON "public"."ai_assistant_contexts" USING "btree" ("service_request_id");



CREATE INDEX "ai_automation_actions_audience_idx" ON "public"."ai_automation_actions" USING "btree" ("audience", "created_at" DESC);



CREATE INDEX "ai_automation_actions_request_idx" ON "public"."ai_automation_actions" USING "btree" ("service_request_id") WHERE ("service_request_id" IS NOT NULL);



CREATE INDEX "ai_automation_actions_status_idx" ON "public"."ai_automation_actions" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "ai_automation_actions_workflow_idx" ON "public"."ai_automation_actions" USING "btree" ("workflow_id", "created_at" DESC);



CREATE INDEX "ai_automation_approvals_pending_idx" ON "public"."ai_automation_approvals" USING "btree" ("status", "created_at" DESC) WHERE ("status" = 'pending'::"text");



CREATE INDEX "ai_automation_feedback_action_idx" ON "public"."ai_automation_feedback" USING "btree" ("action_id");



CREATE INDEX "ai_automation_feedback_decision_idx" ON "public"."ai_automation_feedback" USING "btree" ("user_decision", "created_at" DESC);



CREATE INDEX "ai_availability_forecasts_provider_idx" ON "public"."ai_availability_forecasts" USING "btree" ("provider_id", "forecast_date" DESC);



CREATE INDEX "ai_chat_action_items_open_idx" ON "public"."ai_chat_action_items" USING "btree" ("conversation_id", "status", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "ai_chat_extractions_conv_idx" ON "public"."ai_chat_extractions" USING "btree" ("conversation_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "ai_chat_sentiment_conv_idx" ON "public"."ai_chat_sentiment" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "ai_chat_translations_conv_idx" ON "public"."ai_chat_translations" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "ai_conversation_summaries_conv_idx" ON "public"."ai_conversation_summaries" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "ai_conversation_summaries_conv_window_idx" ON "public"."ai_conversation_summaries" USING "btree" ("conversation_id", "window_key", "style_key", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "ai_demand_forecasts_date_idx" ON "public"."ai_demand_forecasts" USING "btree" ("forecast_date" DESC);



CREATE INDEX "ai_dispatch_predictions_provider_idx" ON "public"."ai_dispatch_predictions" USING "btree" ("provider_id", "created_at" DESC) WHERE ("provider_id" IS NOT NULL);



CREATE INDEX "ai_dispatch_predictions_request_idx" ON "public"."ai_dispatch_predictions" USING "btree" ("service_request_id") WHERE ("service_request_id" IS NOT NULL);



CREATE INDEX "ai_dispatch_predictions_uncompared_idx" ON "public"."ai_dispatch_predictions" USING "btree" ("created_at" DESC) WHERE ("compared_at" IS NULL);



CREATE INDEX "ai_intent_decisions_last_used_idx" ON "public"."ai_intent_decisions" USING "btree" ("last_used_at" DESC);



CREATE INDEX "ai_intent_decisions_lookup_idx" ON "public"."ai_intent_decisions" USING "btree" ("normalized_text", "confidence" DESC);



CREATE INDEX "ai_intent_memory_category_idx" ON "public"."ai_intent_memory" USING "btree" ("final_category_slug") WHERE ("final_category_slug" IS NOT NULL);



CREATE INDEX "ai_intent_memory_created_idx" ON "public"."ai_intent_memory" USING "btree" ("created_at" DESC);



CREATE INDEX "ai_intent_memory_normalized_idx" ON "public"."ai_intent_memory" USING "btree" ("normalized_text");



CREATE INDEX "ai_intent_memory_request_idx" ON "public"."ai_intent_memory" USING "btree" ("service_request_id") WHERE ("service_request_id" IS NOT NULL);



CREATE INDEX "ai_job_analyses_request_idx" ON "public"."ai_job_analyses" USING "btree" ("service_request_id") WHERE ("service_request_id" IS NOT NULL);



CREATE INDEX "ai_job_analyses_uncompared_idx" ON "public"."ai_job_analyses" USING "btree" ("created_at" DESC) WHERE ("compared_at" IS NULL);



CREATE INDEX "ai_knowledge_phrases_category_idx" ON "public"."ai_knowledge_phrases" USING "btree" ("category_slug", "success_rate" DESC);



CREATE INDEX "ai_knowledge_phrases_last_used_idx" ON "public"."ai_knowledge_phrases" USING "btree" ("last_used_at" DESC);



CREATE INDEX "ai_knowledge_phrases_lookup_idx" ON "public"."ai_knowledge_phrases" USING "btree" ("normalized_phrase", "confidence" DESC);



CREATE INDEX "ai_marketplace_balances_snap_idx" ON "public"."ai_marketplace_balances" USING "btree" ("snapshot_at" DESC);



CREATE INDEX "ai_offer_comparisons_request_idx" ON "public"."ai_offer_comparisons" USING "btree" ("service_request_id", "created_at" DESC);



CREATE INDEX "ai_prediction_outcomes_type_idx" ON "public"."ai_prediction_outcomes" USING "btree" ("prediction_type", "created_at" DESC);



CREATE INDEX "ai_predictive_notifications_audience_idx" ON "public"."ai_predictive_notifications" USING "btree" ("audience", "status", "created_at" DESC);



CREATE INDEX "ai_proactive_suggestions_pending_idx" ON "public"."ai_proactive_suggestions" USING "btree" ("audience", "status", "priority" DESC) WHERE ("status" = ANY (ARRAY['pending'::"text", 'shown'::"text"]));



CREATE INDEX "ai_provider_automation_settings_accept_idx" ON "public"."ai_provider_automation_settings" USING "btree" ("auto_accept_enabled") WHERE ("auto_accept_enabled" = true);



CREATE INDEX "ai_service_knowledge_category_idx" ON "public"."ai_service_knowledge" USING "btree" ("category_slug");



CREATE INDEX "ai_vision_analyses_request_idx" ON "public"."ai_vision_analyses" USING "btree" ("service_request_id") WHERE ("service_request_id" IS NOT NULL);



CREATE INDEX "ai_vision_analyses_uncompared_idx" ON "public"."ai_vision_analyses" USING "btree" ("created_at" DESC) WHERE ("compared_at" IS NULL);



CREATE INDEX "ai_voice_transcripts_request_idx" ON "public"."ai_voice_transcripts" USING "btree" ("service_request_id") WHERE ("service_request_id" IS NOT NULL);



CREATE INDEX "ai_voice_transcripts_uncompared_idx" ON "public"."ai_voice_transcripts" USING "btree" ("created_at" DESC) WHERE ("compared_at" IS NULL);



CREATE INDEX "audit_logs_action_idx" ON "public"."audit_logs" USING "btree" ("action");



CREATE INDEX "audit_logs_actor_id_idx" ON "public"."audit_logs" USING "btree" ("actor_id");



CREATE INDEX "audit_logs_created_at_idx" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "audit_logs_entity_idx" ON "public"."audit_logs" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "booking_analytics_events_type_idx" ON "public"."booking_analytics_events" USING "btree" ("event_type", "created_at" DESC);



CREATE INDEX "booking_issue_reports_booking_idx" ON "public"."booking_issue_reports" USING "btree" ("booking_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "booking_issue_reports_moderation_idx" ON "public"."booking_issue_reports" USING "btree" ("moderation_status", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "booking_issue_reports_provider_idx" ON "public"."booking_issue_reports" USING "btree" ("provider_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "booking_slot_feedback_provider_idx" ON "public"."booking_slot_feedback" USING "btree" ("provider_id", "created_at" DESC);



CREATE INDEX "booking_status_log_booking_idx" ON "public"."booking_status_log" USING "btree" ("booking_id", "created_at" DESC);



CREATE INDEX "bookings_customer_starts_idx" ON "public"."bookings" USING "btree" ("customer_id", "starts_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "bookings_provider_starts_idx" ON "public"."bookings" USING "btree" ("provider_id", "starts_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "bookings_recurring_plan_idx" ON "public"."bookings" USING "btree" ("recurring_plan_id") WHERE ("recurring_plan_id" IS NOT NULL);



CREATE INDEX "bookings_request_idx" ON "public"."bookings" USING "btree" ("service_request_id") WHERE (("service_request_id" IS NOT NULL) AND ("deleted_at" IS NULL));



CREATE INDEX "bookings_status_idx" ON "public"."bookings" USING "btree" ("status") WHERE ("deleted_at" IS NULL);



CREATE INDEX "business_briefings_provider_idx" ON "public"."business_briefings" USING "btree" ("provider_id", "briefing_date" DESC);



CREATE INDEX "business_goal_progress_goal_idx" ON "public"."business_goal_progress" USING "btree" ("goal_id", "created_at" DESC);



CREATE INDEX "business_goals_provider_idx" ON "public"."business_goals" USING "btree" ("provider_id", "active");



CREATE INDEX "business_health_score_idx" ON "public"."business_health" USING "btree" ("health_score" DESC);



CREATE INDEX "business_insights_provider_idx" ON "public"."business_insights" USING "btree" ("provider_id", "created_at" DESC);



CREATE INDEX "business_recs_provider_idx" ON "public"."business_recommendations" USING "btree" ("provider_id", "status", "created_at" DESC);



CREATE INDEX "business_sub_payments_activated_idx" ON "public"."business_subscription_payments" USING "btree" ("activated_at" DESC NULLS LAST);



CREATE INDEX "business_subscription_payments_provider_idx" ON "public"."business_subscription_payments" USING "btree" ("provider_id", "created_at" DESC);



CREATE INDEX "capacity_history_provider_idx" ON "public"."capacity_history" USING "btree" ("provider_id", "day" DESC);



CREATE INDEX "cell_policies_frozen_idx" ON "public"."cell_policies" USING "btree" ("frozen") WHERE ("frozen" = true);



CREATE INDEX "chat_analytics_events_type_idx" ON "public"."chat_analytics_events" USING "btree" ("event_type", "created_at" DESC);



CREATE INDEX "chat_voice_transcript_translations_conv_idx" ON "public"."chat_voice_transcript_translations" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "chat_voice_transcripts_conv_idx" ON "public"."chat_voice_transcripts" USING "btree" ("conversation_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "chat_voice_transcripts_fts_idx" ON "public"."chat_voice_transcripts" USING "gin" ("to_tsvector"('"simple"'::"regconfig", COALESCE("transcript_text", ''::"text"))) WHERE (("deleted_at" IS NULL) AND (COALESCE("transcript_text", ''::"text") <> ''::"text"));



CREATE INDEX "contact_release_grants_customer_idx" ON "public"."contact_release_grants" USING "btree" ("customer_id", "granted_at" DESC);



CREATE INDEX "conversation_participants_user_idx" ON "public"."conversation_participants" USING "btree" ("user_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "conversation_typing_expires_idx" ON "public"."conversation_typing" USING "btree" ("expires_at");



CREATE INDEX "conversations_admin_user_idx" ON "public"."conversations" USING "btree" ("admin_user_id") WHERE ("admin_user_id" IS NOT NULL);



CREATE INDEX "conversations_customer_activity_idx" ON "public"."conversations" USING "btree" ("customer_id", "last_message_at" DESC NULLS LAST) WHERE ("deleted_at" IS NULL);



CREATE INDEX "conversations_customer_idx" ON "public"."conversations" USING "btree" ("customer_id", "last_message_at" DESC);



CREATE INDEX "conversations_package_idx" ON "public"."conversations" USING "btree" ("package_id") WHERE ("package_id" IS NOT NULL);



CREATE INDEX "conversations_project_idx" ON "public"."conversations" USING "btree" ("project_id") WHERE ("project_id" IS NOT NULL);



CREATE INDEX "conversations_provider_activity_idx" ON "public"."conversations" USING "btree" ("provider_id", "last_message_at" DESC NULLS LAST) WHERE ("deleted_at" IS NULL);



CREATE INDEX "conversations_provider_idx" ON "public"."conversations" USING "btree" ("provider_id", "last_message_at" DESC);



CREATE INDEX "conversations_scope_idx" ON "public"."conversations" USING "btree" ("chat_scope", "last_message_at" DESC);



CREATE INDEX "dispute_evidence_dispute_idx" ON "public"."dispute_evidence" USING "btree" ("dispute_id", "created_at" DESC);



CREATE INDEX "document_download_history_doc_idx" ON "public"."document_download_history" USING "btree" ("document_id", "created_at" DESC);



CREATE INDEX "emergency_dispatch_responses_dispatch_idx" ON "public"."emergency_dispatch_responses" USING "btree" ("dispatch_id", "responded_at" DESC);



CREATE INDEX "emergency_dispatches_status_idx" ON "public"."emergency_dispatches" USING "btree" ("status", "activated_at" DESC);



CREATE INDEX "emergency_live_locations_request_idx" ON "public"."emergency_live_locations" USING "btree" ("service_request_id");



CREATE INDEX "emergency_timeline_events_request_idx" ON "public"."emergency_timeline_events" USING "btree" ("service_request_id", "created_at");



CREATE INDEX "entity_relationships_from_idx" ON "public"."entity_relationships" USING "btree" ("from_entity_type", "from_entity_id") WHERE ("confirmed" = true);



CREATE INDEX "entity_relationships_to_idx" ON "public"."entity_relationships" USING "btree" ("to_entity_type", "to_entity_id") WHERE ("confirmed" = true);



CREATE INDEX "finance_analytics_cache_expires_idx" ON "public"."finance_analytics_cache" USING "btree" ("expires_at");



CREATE INDEX "financial_documents_payment_idx" ON "public"."financial_documents" USING "btree" ("payment_id");



CREATE UNIQUE INDEX "financial_documents_payment_type_active_uidx" ON "public"."financial_documents" USING "btree" ("payment_id", "document_type") WHERE ("status" = ANY (ARRAY['issued'::"text", 'regenerated'::"text"]));



CREATE INDEX "financial_documents_provider_idx" ON "public"."financial_documents" USING "btree" ("provider_id", "created_at" DESC);



CREATE INDEX "financial_documents_type_idx" ON "public"."financial_documents" USING "btree" ("document_type", "created_at" DESC);



CREATE INDEX "forecast_accuracy_model_idx" ON "public"."forecast_accuracy" USING "btree" ("model_key", "created_at" DESC);



CREATE INDEX "forecast_history_created_idx" ON "public"."forecast_history" USING "btree" ("created_at" DESC);



CREATE INDEX "forecast_history_lookup_idx" ON "public"."forecast_history" USING "btree" ("category_key", "region_key", "horizon", "created_at" DESC);



CREATE INDEX "forecast_market_snapshots_lookup_idx" ON "public"."forecast_market_snapshots" USING "btree" ("category_key", "region_key");



CREATE INDEX "forecast_results_cache_idx" ON "public"."forecast_results" USING "btree" ("category_key", "region_key", "horizon", "cached_until");



CREATE INDEX "forecast_results_provider_idx" ON "public"."forecast_results" USING "btree" ("provider_id", "horizon", "created_at" DESC);



CREATE INDEX "fraud_events_entity_idx" ON "public"."fraud_events" USING "btree" ("entity_type", "entity_id", "created_at" DESC);



CREATE INDEX "fraud_events_open_idx" ON "public"."fraud_events" USING "btree" ("created_at" DESC) WHERE (("resolved_at" IS NULL) AND ("false_positive" = false));



CREATE INDEX "fraud_events_type_idx" ON "public"."fraud_events" USING "btree" ("event_type", "created_at" DESC);



CREATE INDEX "images_provider_gallery_featured_idx" ON "public"."images" USING "btree" ("provider_id") WHERE ((("kind")::"text" = 'gallery'::"text") AND ("deleted_at" IS NULL) AND ("is_featured" = true));



CREATE INDEX "images_provider_kind_idx" ON "public"."images" USING "btree" ("provider_id", "kind") WHERE ("deleted_at" IS NULL);



CREATE INDEX "investigation_history_idx" ON "public"."investigation_history" USING "btree" ("investigation_id", "created_at");



CREATE INDEX "investigation_notes_idx" ON "public"."investigation_notes" USING "btree" ("investigation_id", "created_at");



CREATE INDEX "investigations_status_idx" ON "public"."investigations" USING "btree" ("status", "priority", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "invoices_provider_id_idx" ON "public"."invoices" USING "btree" ("provider_id");



CREATE INDEX "lead_pricing_history_provider_idx" ON "public"."lead_pricing_history" USING "btree" ("provider_id", "created_at" DESC);



CREATE INDEX "lead_pricing_history_session_idx" ON "public"."lead_pricing_history" USING "btree" ("unlock_session_id");



CREATE INDEX "lead_unlock_payments_provider_idx" ON "public"."lead_unlock_payments" USING "btree" ("provider_id", "created_at" DESC);



CREATE INDEX "lead_unlock_payments_session_idx" ON "public"."lead_unlock_payments" USING "btree" ("unlock_session_id");



CREATE INDEX "lead_unlock_payments_unlocked_idx" ON "public"."lead_unlock_payments" USING "btree" ("unlocked_at" DESC NULLS LAST) WHERE ("unlock_granted" = true);



CREATE INDEX "learning_events_customer_created_idx" ON "public"."learning_events" USING "btree" ("customer_id", "created_at" DESC) WHERE ("customer_id" IS NOT NULL);



CREATE INDEX "learning_events_provider_created_idx" ON "public"."learning_events" USING "btree" ("provider_id", "created_at" DESC) WHERE ("provider_id" IS NOT NULL);



CREATE INDEX "learning_events_request_idx" ON "public"."learning_events" USING "btree" ("service_request_id") WHERE ("service_request_id" IS NOT NULL);



CREATE INDEX "learning_events_type_created_idx" ON "public"."learning_events" USING "btree" ("event_type", "created_at" DESC);



CREATE INDEX "marketplace_algo_module_idx" ON "public"."marketplace_algorithm_versions" USING "btree" ("module_key", "enabled");



CREATE INDEX "marketplace_cat_opp_idx" ON "public"."marketplace_category_metrics" USING "btree" ("opportunity_score" DESC NULLS LAST);



CREATE INDEX "marketplace_kg_type_idx" ON "public"."marketplace_knowledge_graph" USING "btree" ("node_type");



CREATE INDEX "marketplace_notifications_user_idx" ON "public"."marketplace_notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "marketplace_notifications_user_unread_idx" ON "public"."marketplace_notifications" USING "btree" ("user_id", "created_at" DESC) WHERE ("read_at" IS NULL);



CREATE UNIQUE INDEX "marketplace_offers_one_sent_per_provider" ON "public"."marketplace_offers" USING "btree" ("service_request_id", "provider_id") WHERE ("status" = 'sent'::"text");



CREATE INDEX "marketplace_offers_provider_idx" ON "public"."marketplace_offers" USING "btree" ("provider_id", "created_at" DESC);



CREATE INDEX "marketplace_offers_request_idx" ON "public"."marketplace_offers" USING "btree" ("service_request_id", "created_at" DESC);



CREATE INDEX "marketplace_opp_status_idx" ON "public"."marketplace_opportunities" USING "btree" ("status", "score" DESC);



CREATE INDEX "marketplace_recs_audience_idx" ON "public"."marketplace_recommendations" USING "btree" ("audience", "status", "created_at" DESC);



CREATE INDEX "marketplace_region_opp_idx" ON "public"."marketplace_region_metrics" USING "btree" ("opportunity_score" DESC NULLS LAST);



CREATE INDEX "marketplace_reports_type_idx" ON "public"."marketplace_reports" USING "btree" ("report_type", "created_at" DESC);



CREATE INDEX "marketplace_request_projections_phase_idx" ON "public"."marketplace_request_projections" USING "btree" ("lifecycle_phase");



CREATE UNIQUE INDEX "marketplace_selections_one_active_per_request" ON "public"."marketplace_selections" USING "btree" ("service_request_id") WHERE ("status" = ANY (ARRAY['pending_unlock'::"text", 'unlocked'::"text"]));



CREATE INDEX "marketplace_sims_created_idx" ON "public"."marketplace_simulations" USING "btree" ("created_at" DESC);



CREATE INDEX "match_assignments_provider_idx" ON "public"."match_assignments" USING "btree" ("provider_id", "assigned_at" DESC);



CREATE INDEX "match_assignments_request_idx" ON "public"."match_assignments" USING "btree" ("service_request_id", "rank_in_pool");



CREATE INDEX "match_pools_status_idx" ON "public"."match_pools" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "matching_explanations_provider_idx" ON "public"."matching_explanations" USING "btree" ("provider_id", "created_at" DESC);



CREATE INDEX "matching_feedback_provider_idx" ON "public"."matching_feedback" USING "btree" ("provider_id", "created_at" DESC);



CREATE INDEX "matching_history_created_idx" ON "public"."matching_history" USING "btree" ("created_at" DESC);



CREATE INDEX "matching_scores_cache_idx" ON "public"."matching_scores" USING "btree" ("provider_id", "cached_until") WHERE ("cached_until" IS NOT NULL);



CREATE INDEX "matching_scores_provider_idx" ON "public"."matching_scores" USING "btree" ("provider_id", "computed_at" DESC);



CREATE INDEX "matching_scores_request_idx" ON "public"."matching_scores" USING "btree" ("request_id", "rank") WHERE ("request_id" IS NOT NULL);



CREATE INDEX "media_objects_conversation_idx" ON "public"."media_objects" USING "btree" ("conversation_id") WHERE (("conversation_id" IS NOT NULL) AND ("deleted_at" IS NULL));



CREATE INDEX "media_objects_owner_idx" ON "public"."media_objects" USING "btree" ("owner_user_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "media_objects_project_idx" ON "public"."media_objects" USING "btree" ("project_id", "created_at" DESC) WHERE (("project_id" IS NOT NULL) AND ("deleted_at" IS NULL));



CREATE INDEX "media_processing_jobs_media_idx" ON "public"."media_processing_jobs" USING "btree" ("media_object_id", "created_at" DESC);



CREATE INDEX "media_processing_jobs_queue_idx" ON "public"."media_processing_jobs" USING "btree" ("status", "created_at") WHERE ("status" = ANY (ARRAY['queued'::"text", 'running'::"text"]));



CREATE INDEX "message_attachments_conversation_idx" ON "public"."message_attachments" USING "btree" ("conversation_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "message_attachments_message_idx" ON "public"."message_attachments" USING "btree" ("message_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "message_attachments_name_fts_idx" ON "public"."message_attachments" USING "gin" ("to_tsvector"('"simple"'::"regconfig", COALESCE("file_name", ''::"text"))) WHERE ("deleted_at" IS NULL);



CREATE INDEX "message_attachments_pinned_idx" ON "public"."message_attachments" USING "btree" ("conversation_id", "pinned_at" DESC) WHERE (("is_pinned" = true) AND ("deleted_at" IS NULL));



CREATE INDEX "message_attachments_restore_idx" ON "public"."message_attachments" USING "btree" ("restore_until") WHERE (("deleted_at" IS NOT NULL) AND ("restore_until" IS NOT NULL));



CREATE INDEX "message_read_receipts_user_idx" ON "public"."message_read_receipts" USING "btree" ("user_id", "read_at" DESC NULLS LAST);



CREATE INDEX "messages_body_fts_idx" ON "public"."messages" USING "gin" ("to_tsvector"('"simple"'::"regconfig", COALESCE("body_text", ''::"text"))) WHERE (("deleted_at" IS NULL) AND (COALESCE("body_text", ''::"text") <> ''::"text"));



CREATE INDEX "messages_body_trgm_idx" ON "public"."messages" USING "gin" ("body_text" "public"."gin_trgm_ops");



CREATE INDEX "messages_conversation_created_idx" ON "public"."messages" USING "btree" ("conversation_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "messages_conversation_idx" ON "public"."messages" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "messages_pinned_idx" ON "public"."messages" USING "btree" ("conversation_id", "pinned_at" DESC) WHERE ("is_pinned" = true);



CREATE INDEX "messages_reply_to_idx" ON "public"."messages" USING "btree" ("reply_to_message_id") WHERE ("reply_to_message_id" IS NOT NULL);



CREATE INDEX "monetization_audit_logs_provider_idx" ON "public"."monetization_audit_logs" USING "btree" ("provider_id", "created_at" DESC);



CREATE UNIQUE INDEX "monetization_stripe_customer_uidx" ON "public"."provider_monetization_plans" USING "btree" ("stripe_customer_id") WHERE ("stripe_customer_id" IS NOT NULL);



CREATE UNIQUE INDEX "monetization_stripe_subscription_uidx" ON "public"."provider_monetization_plans" USING "btree" ("stripe_subscription_id") WHERE ("stripe_subscription_id" IS NOT NULL);



CREATE INDEX "notification_delivery_attempts_notif_idx" ON "public"."notification_delivery_attempts" USING "btree" ("notification_id", "channel");



CREATE INDEX "notification_digests_user_idx" ON "public"."notification_digests" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "offer_clarifications_offer_idx" ON "public"."offer_clarifications" USING "btree" ("offer_id", "created_at");



CREATE INDEX "offer_templates_provider_idx" ON "public"."offer_templates" USING "btree" ("provider_id", "updated_at" DESC);



CREATE INDEX "payment_disputes_payment_idx" ON "public"."payment_disputes" USING "btree" ("payment_id", "created_at" DESC);



CREATE INDEX "payment_disputes_status_idx" ON "public"."payment_disputes" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "payment_disputes_status_opened_idx" ON "public"."payment_disputes" USING "btree" ("status", "opened_at" DESC);



CREATE INDEX "payment_events_payment_id_idx" ON "public"."payment_events" USING "btree" ("payment_id", "created_at");



CREATE INDEX "payment_status_snapshots_payment_idx" ON "public"."payment_status_snapshots" USING "btree" ("payment_id", "created_at");



CREATE INDEX "payment_webhook_events_payment_idx" ON "public"."payment_webhook_events" USING "btree" ("payment_id", "received_at" DESC);



CREATE UNIQUE INDEX "payments_idempotency_key_uidx" ON "public"."payments" USING "btree" ("idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "payments_paid_at_idx" ON "public"."payments" USING "btree" ("paid_at" DESC) WHERE ("payment_status" = 'paid'::"public"."payment_status");



CREATE UNIQUE INDEX "payments_payment_reference_uidx" ON "public"."payments" USING "btree" ("payment_reference");



CREATE INDEX "payments_provider_id_idx" ON "public"."payments" USING "btree" ("provider_id");



CREATE INDEX "payments_provider_paid_idx" ON "public"."payments" USING "btree" ("provider_id", "payment_status", "paid_at" DESC);



CREATE INDEX "payments_purpose_status_idx" ON "public"."payments" USING "btree" ("purpose", "payment_status", "created_at" DESC);



CREATE INDEX "payments_purpose_status_paid_idx" ON "public"."payments" USING "btree" ("purpose", "payment_status", "paid_at" DESC);



CREATE INDEX "payments_status_idx" ON "public"."payments" USING "btree" ("payment_status");



CREATE UNIQUE INDEX "payments_stripe_cs_uidx" ON "public"."payments" USING "btree" ("stripe_checkout_session_id") WHERE ("stripe_checkout_session_id" IS NOT NULL);



CREATE UNIQUE INDEX "payments_stripe_pi_uidx" ON "public"."payments" USING "btree" ("stripe_payment_intent_id") WHERE ("stripe_payment_intent_id" IS NOT NULL);



CREATE INDEX "payments_submitted_at_idx" ON "public"."payments" USING "btree" ("submitted_at" DESC NULLS LAST);



CREATE INDEX "payments_subscription_id_idx" ON "public"."payments" USING "btree" ("subscription_id");



CREATE UNIQUE INDEX "payments_unlock_session_active_uidx" ON "public"."payments" USING "btree" ("unlock_session_id") WHERE (("unlock_session_id" IS NOT NULL) AND ("payment_status" = ANY (ARRAY['pending'::"public"."payment_status", 'pending_review'::"public"."payment_status", 'paid'::"public"."payment_status"])));



CREATE INDEX "payments_unlock_session_idx" ON "public"."payments" USING "btree" ("unlock_session_id") WHERE ("unlock_session_id" IS NOT NULL);



CREATE INDEX "pdf_generation_logs_doc_idx" ON "public"."pdf_generation_logs" USING "btree" ("document_id", "created_at" DESC);



CREATE INDEX "platform_alerts_status_idx" ON "public"."platform_alerts" USING "btree" ("status", "severity", "created_at" DESC);



CREATE INDEX "platform_anomalies_open_idx" ON "public"."platform_anomalies" USING "btree" ("detected_at" DESC) WHERE (("resolved_at" IS NULL) AND ("false_positive" = false));



CREATE INDEX "platform_health_metrics_snapshot_idx" ON "public"."platform_health_metrics" USING "btree" ("period", "snapshot_at" DESC);



CREATE INDEX "platform_ops_audit_idx" ON "public"."platform_ops_audit" USING "btree" ("created_at" DESC);



CREATE INDEX "platform_ops_tasks_status_idx" ON "public"."platform_ops_tasks" USING "btree" ("status", "priority", "created_at" DESC);



CREATE INDEX "platform_trends_lookup_idx" ON "public"."platform_trends" USING "btree" ("metric_key", "period", "period_start" DESC);



CREATE INDEX "pricing_history_created_idx" ON "public"."pricing_history" USING "btree" ("created_at" DESC);



CREATE INDEX "pricing_history_provider_idx" ON "public"."pricing_history" USING "btree" ("provider_id", "created_at" DESC);



CREATE INDEX "pricing_market_data_lookup_idx" ON "public"."pricing_market_data" USING "btree" ("category_key", "region_key");



CREATE INDEX "project_activity_events_project_idx" ON "public"."project_activity_events" USING "btree" ("project_id", "created_at" DESC);



CREATE INDEX "project_approvals_pending_idx" ON "public"."project_approvals" USING "btree" ("project_id", "created_at" DESC) WHERE ("status" = 'pending'::"text");



CREATE INDEX "project_approvals_project_idx" ON "public"."project_approvals" USING "btree" ("project_id", "status", "created_at" DESC);



CREATE INDEX "project_checklist_items_checklist_idx" ON "public"."project_checklist_items" USING "btree" ("checklist_id");



CREATE INDEX "project_checklists_project_idx" ON "public"."project_checklists" USING "btree" ("project_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "project_documents_gallery_idx" ON "public"."project_documents" USING "btree" ("project_id", "gallery_category", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "project_documents_package_idx" ON "public"."project_documents" USING "btree" ("package_id", "created_at" DESC) WHERE (("package_id" IS NOT NULL) AND ("deleted_at" IS NULL));



CREATE INDEX "project_documents_project_idx" ON "public"."project_documents" USING "btree" ("project_id", "created_at" DESC);



CREATE INDEX "project_packages_project_idx" ON "public"."project_packages" USING "btree" ("project_id", "sort_order");



CREATE INDEX "project_packages_request_idx" ON "public"."project_packages" USING "btree" ("service_request_id") WHERE ("service_request_id" IS NOT NULL);



CREATE INDEX "project_tasks_project_idx" ON "public"."project_tasks" USING "btree" ("project_id", "status", "due_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "project_timeline_events_project_idx" ON "public"."project_timeline_events" USING "btree" ("project_id", "created_at");



CREATE INDEX "provider_availability_breaks_provider_idx" ON "public"."provider_availability_breaks" USING "btree" ("provider_id", "day_of_week");



CREATE INDEX "provider_blocked_times_range_idx" ON "public"."provider_blocked_times" USING "btree" ("provider_id", "starts_at", "ends_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "provider_engagement_provider_created_idx" ON "public"."provider_engagement_events" USING "btree" ("provider_id", "created_at" DESC);



CREATE INDEX "provider_engagement_type_created_idx" ON "public"."provider_engagement_events" USING "btree" ("event_type", "created_at" DESC);



CREATE INDEX "provider_monetization_plans_mode_idx" ON "public"."provider_monetization_plans" USING "btree" ("billing_mode", "status");



CREATE INDEX "provider_monthly_unlock_usage_period_idx" ON "public"."provider_monthly_unlock_usage" USING "btree" ("period_ym");



CREATE INDEX "provider_opportunities_provider_idx" ON "public"."provider_opportunities" USING "btree" ("provider_id", "status", "created_at" DESC);



CREATE INDEX "provider_performance_quality_idx" ON "public"."provider_performance_scores" USING "btree" ("data_quality" DESC, "sample_size" DESC);



CREATE INDEX "provider_performance_score_idx" ON "public"."provider_performance_scores" USING "btree" ("performance_score" DESC);



CREATE INDEX "provider_reputation_events_provider_idx" ON "public"."provider_reputation_events" USING "btree" ("provider_id", "created_at" DESC);



CREATE INDEX "provider_reputation_explanations_public_idx" ON "public"."provider_reputation_explanations" USING "btree" ("provider_id", "audience", "locale") WHERE (("audience" = 'public'::"text") AND ("polarity" = 'positive'::"text"));



CREATE INDEX "provider_reputation_history_provider_idx" ON "public"."provider_reputation_history" USING "btree" ("provider_id", "created_at" DESC);



CREATE INDEX "provider_reputation_signals_provider_idx" ON "public"."provider_reputation_signals" USING "btree" ("provider_id", "category");



CREATE INDEX "provider_routes_lookup_idx" ON "public"."provider_routes" USING "btree" ("provider_id", "route_date" DESC);



CREATE INDEX "provider_schedule_gaps_provider_idx" ON "public"."provider_schedule_gaps" USING "btree" ("provider_id", "gap_date", "status");



CREATE INDEX "provider_services_provider_idx" ON "public"."provider_services" USING "btree" ("provider_id", "sort_order") WHERE ("deleted_at" IS NULL);



CREATE INDEX "provider_verification_checks_provider_idx" ON "public"."provider_verification_checks" USING "btree" ("provider_id", "status");



CREATE INDEX "provider_verification_checks_public_idx" ON "public"."provider_verification_checks" USING "btree" ("provider_id", "verified_at" DESC) WHERE ("status" = 'verified'::"text");



CREATE INDEX "provider_verifications_status_idx" ON "public"."provider_verifications" USING "btree" ("status");



CREATE INDEX "providers_city_category_idx" ON "public"."providers" USING "btree" ("city_id", "category_id", "status");



CREATE INDEX "providers_owner_id_idx" ON "public"."providers" USING "btree" ("owner_id");



CREATE INDEX "providers_status_idx" ON "public"."providers" USING "btree" ("status") WHERE ("deleted_at" IS NULL);



CREATE INDEX "quality_case_assignments_case_idx" ON "public"."quality_case_assignments" USING "btree" ("case_id", "assigned_at" DESC);



CREATE INDEX "quality_case_evidence_case_idx" ON "public"."quality_case_evidence" USING "btree" ("case_id", "created_at");



CREATE INDEX "quality_case_history_case_idx" ON "public"."quality_case_history" USING "btree" ("case_id", "created_at");



CREATE INDEX "quality_case_messages_case_idx" ON "public"."quality_case_messages" USING "btree" ("case_id", "created_at");



CREATE INDEX "quality_cases_booking_idx" ON "public"."quality_cases" USING "btree" ("booking_id") WHERE ("booking_id" IS NOT NULL);



CREATE INDEX "quality_cases_customer_idx" ON "public"."quality_cases" USING "btree" ("customer_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "quality_cases_provider_idx" ON "public"."quality_cases" USING "btree" ("provider_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "quality_cases_status_idx" ON "public"."quality_cases" USING "btree" ("status", "priority", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "quote_items_quote_idx" ON "public"."quote_items" USING "btree" ("quote_id", "sort_order");



CREATE INDEX "quotes_request_idx" ON "public"."quotes" USING "btree" ("service_request_id", "created_at" DESC);



CREATE INDEX "recurring_plans_customer_idx" ON "public"."recurring_plans" USING "btree" ("customer_id", "status", "created_at" DESC);



CREATE INDEX "recurring_plans_next_visit_idx" ON "public"."recurring_plans" USING "btree" ("next_visit_at") WHERE (("status" = 'active'::"text") AND ("next_visit_at" IS NOT NULL));



CREATE INDEX "recurring_plans_provider_idx" ON "public"."recurring_plans" USING "btree" ("provider_id", "status") WHERE ("provider_id" IS NOT NULL);



CREATE INDEX "recurring_recommendations_customer_idx" ON "public"."recurring_recommendations" USING "btree" ("customer_id", "status", "created_at" DESC);



CREATE INDEX "recurring_visits_plan_idx" ON "public"."recurring_visits" USING "btree" ("plan_id", "planned_starts_at");



CREATE INDEX "recurring_visits_status_idx" ON "public"."recurring_visits" USING "btree" ("status", "planned_starts_at");



CREATE INDEX "refund_history_refund_idx" ON "public"."refund_history" USING "btree" ("refund_request_id", "created_at");



CREATE INDEX "refund_requests_payment_idx" ON "public"."refund_requests" USING "btree" ("payment_id", "created_at" DESC);



CREATE INDEX "refund_requests_provider_idx" ON "public"."refund_requests" USING "btree" ("provider_id", "created_at" DESC);



CREATE INDEX "refund_requests_status_idx" ON "public"."refund_requests" USING "btree" ("status", "created_at" DESC);



CREATE UNIQUE INDEX "refund_requests_stripe_uidx" ON "public"."refund_requests" USING "btree" ("stripe_refund_id") WHERE ("stripe_refund_id" IS NOT NULL);



CREATE INDEX "refund_requests_succeeded_idx" ON "public"."refund_requests" USING "btree" ("status", "completed_at" DESC) WHERE ("status" = 'succeeded'::"text");



CREATE INDEX "review_flags_open_idx" ON "public"."review_flags" USING "btree" ("review_id", "created_at" DESC) WHERE ("resolved_at" IS NULL);



CREATE INDEX "review_media_review_idx" ON "public"."review_media" USING "btree" ("review_id", "sort_order");



CREATE INDEX "review_moderation_review_idx" ON "public"."review_moderation" USING "btree" ("review_id", "created_at" DESC);



CREATE INDEX "review_ratings_review_idx" ON "public"."review_ratings" USING "btree" ("review_id");



CREATE INDEX "risk_score_history_entity_idx" ON "public"."risk_score_history" USING "btree" ("entity_type", "entity_id", "created_at" DESC);



CREATE INDEX "risk_scores_level_idx" ON "public"."risk_scores" USING "btree" ("risk_level", "internal_score" DESC);



CREATE INDEX "schedule_history_date_idx" ON "public"."schedule_history" USING "btree" ("schedule_date" DESC);



CREATE INDEX "schedule_history_provider_idx" ON "public"."schedule_history" USING "btree" ("provider_id", "created_at" DESC);



CREATE INDEX "schedule_recommendations_provider_idx" ON "public"."schedule_recommendations" USING "btree" ("provider_id", "status", "created_at" DESC);



CREATE INDEX "search_logs_category_created_idx" ON "public"."search_logs" USING "btree" ("category_slug", "created_at" DESC) WHERE ("category_slug" IS NOT NULL);



CREATE INDEX "search_logs_city_created_idx" ON "public"."search_logs" USING "btree" ("city_slug", "created_at" DESC) WHERE ("city_slug" IS NOT NULL);



CREATE INDEX "search_logs_created_at_idx" ON "public"."search_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "search_logs_problem_id_idx" ON "public"."search_logs" USING "btree" ("problem_id") WHERE ("problem_id" IS NOT NULL);



CREATE INDEX "search_logs_provider_ids_gin" ON "public"."search_logs" USING "gin" ("provider_ids");



CREATE INDEX "search_logs_user_id_idx" ON "public"."search_logs" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "service_projects_customer_idx" ON "public"."service_projects" USING "btree" ("customer_id", "created_at" DESC);



CREATE INDEX "service_projects_status_idx" ON "public"."service_projects" USING "btree" ("status", "updated_at" DESC);



CREATE INDEX "service_request_images_request_idx" ON "public"."service_request_images" USING "btree" ("request_id", "sort_order");



CREATE INDEX "service_requests_customer_idx" ON "public"."service_requests" USING "btree" ("customer_id", "created_at" DESC);



CREATE UNIQUE INDEX "service_requests_one_pending_per_pair" ON "public"."service_requests" USING "btree" ("customer_id", "provider_id") WHERE ("status" = 'pending'::"public"."service_request_status");



CREATE INDEX "service_requests_provider_status_idx" ON "public"."service_requests" USING "btree" ("provider_id", "status", "created_at" DESC);



CREATE INDEX "service_requests_v2_matching_idx" ON "public"."service_requests" USING "btree" ("lifecycle_version", "status", "category_id", "city_id", "created_at" DESC) WHERE (("lifecycle_version" >= 2) AND ("provider_id" IS NULL));



CREATE INDEX "service_review_helpful_votes_user_idx" ON "public"."service_review_helpful_votes" USING "btree" ("user_id");



CREATE INDEX "service_reviews_booking_uidx" ON "public"."service_reviews" USING "btree" ("booking_id") WHERE ("booking_id" IS NOT NULL);



CREATE INDEX "service_reviews_provider_helpful_idx" ON "public"."service_reviews" USING "btree" ("provider_id", "helpful_count" DESC) WHERE (("deleted_at" IS NULL) AND ("status" = 'approved'::"public"."review_status"));



CREATE INDEX "service_reviews_provider_idx" ON "public"."service_reviews" USING "btree" ("provider_id", "created_at" DESC);



CREATE INDEX "service_reviews_provider_public_idx" ON "public"."service_reviews" USING "btree" ("provider_id", "created_at" DESC) WHERE (("deleted_at" IS NULL) AND ("status" = 'approved'::"public"."review_status"));



CREATE INDEX "service_reviews_provider_rating_idx" ON "public"."service_reviews" USING "btree" ("provider_id", "rating" DESC) WHERE (("deleted_at" IS NULL) AND ("status" = 'approved'::"public"."review_status"));



CREATE INDEX "smart_notifications_search_idx" ON "public"."smart_notifications" USING "gin" ("to_tsvector"('"simple"'::"regconfig", ((((((COALESCE("title_en", ''::"text") || ' '::"text") || COALESCE("title_ar", ''::"text")) || ' '::"text") || COALESCE("body_en", ''::"text")) || ' '::"text") || COALESCE("body_ar", ''::"text"))));



CREATE INDEX "smart_notifications_unread_idx" ON "public"."smart_notifications" USING "btree" ("user_id", "created_at" DESC) WHERE (("status" = 'unread'::"text") AND ("deleted_at" IS NULL) AND ("is_group_summary" = false));



CREATE INDEX "smart_notifications_user_group_idx" ON "public"."smart_notifications" USING "btree" ("user_id", "group_key", "created_at" DESC) WHERE (("deleted_at" IS NULL) AND ("group_key" IS NOT NULL));



CREATE INDEX "smart_notifications_user_status_idx" ON "public"."smart_notifications" USING "btree" ("user_id", "status", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "subscriptions_expires_at_idx" ON "public"."subscriptions" USING "btree" ("expires_at") WHERE ("expires_at" IS NOT NULL);



CREATE INDEX "subscriptions_provider_id_idx" ON "public"."subscriptions" USING "btree" ("provider_id");



CREATE INDEX "subscriptions_status_idx" ON "public"."subscriptions" USING "btree" ("status");



CREATE INDEX "unlock_reliability_signals_provider_idx" ON "public"."unlock_reliability_signals" USING "btree" ("provider_id", "created_at" DESC);



CREATE INDEX "unlock_sessions_payment_id_idx" ON "public"."unlock_sessions" USING "btree" ("payment_id") WHERE ("payment_id" IS NOT NULL);



CREATE INDEX "unlock_sessions_provider_status_idx" ON "public"."unlock_sessions" USING "btree" ("provider_id", "status", "sla_deadline");



CREATE INDEX "unlock_sessions_request_idx" ON "public"."unlock_sessions" USING "btree" ("service_request_id", "opened_at" DESC);



CREATE INDEX "unlock_sessions_sla_idx" ON "public"."unlock_sessions" USING "btree" ("status", "sla_deadline") WHERE ("status" = ANY (ARRAY['opened'::"text", 'payment_pending'::"text"]));



CREATE UNIQUE INDEX "user_roles_active_unique" ON "public"."user_roles" USING "btree" ("user_id", "role") WHERE ("revoked_at" IS NULL);



CREATE INDEX "verification_types_level_idx" ON "public"."verification_types" USING "btree" ("level_slug", "sort_order");



CREATE OR REPLACE TRIGGER "conversations_updated_at" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "messages_touch_conversation" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."touch_conversation_last_message"();



CREATE OR REPLACE TRIGGER "profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "provider_request_settings_updated_at" BEFORE UPDATE ON "public"."provider_request_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "provider_services_updated_at" BEFORE UPDATE ON "public"."provider_services" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "provider_verifications_updated_at" BEFORE UPDATE ON "public"."provider_verifications" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "provider_working_hours_updated_at" BEFORE UPDATE ON "public"."provider_working_hours" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "providers_prevent_privileged_self_updates" BEFORE UPDATE ON "public"."providers" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_provider_privileged_self_updates"();



CREATE OR REPLACE TRIGGER "providers_updated_at" BEFORE UPDATE ON "public"."providers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "quotes_updated_at" BEFORE UPDATE ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "service_requests_updated_at" BEFORE UPDATE ON "public"."service_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "subscription_plans_updated_at" BEFORE UPDATE ON "public"."subscription_plans" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "subscriptions_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_bookings_no_overlap" BEFORE INSERT OR UPDATE OF "starts_at", "ends_at", "status", "deleted_at" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."bookings_no_overlap"();



CREATE OR REPLACE TRIGGER "trg_bookings_updated_at" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."touch_booking_updated_at"();



CREATE OR REPLACE TRIGGER "trg_log_booking_status" AFTER INSERT OR UPDATE OF "status" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."log_booking_status_change"();



CREATE OR REPLACE TRIGGER "trg_media_objects_storage" AFTER INSERT OR DELETE OR UPDATE ON "public"."media_objects" FOR EACH ROW EXECUTE FUNCTION "public"."trg_media_objects_storage"();



CREATE OR REPLACE TRIGGER "trg_review_helpful_count" AFTER INSERT OR DELETE ON "public"."service_review_helpful_votes" FOR EACH ROW EXECUTE FUNCTION "public"."sync_review_helpful_count"();



CREATE OR REPLACE TRIGGER "trg_service_request_status_transition" BEFORE UPDATE OF "status" ON "public"."service_requests" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_service_request_status_transition"();



CREATE OR REPLACE TRIGGER "trg_sync_conversation_participants" AFTER INSERT ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."sync_conversation_participants"();



CREATE OR REPLACE TRIGGER "users_prevent_privileged_self_updates" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_privileged_user_self_updates"();



CREATE OR REPLACE TRIGGER "users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."admin_action_logs"
    ADD CONSTRAINT "admin_action_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_broadcasts"
    ADD CONSTRAINT "admin_broadcasts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."admin_broadcasts"
    ADD CONSTRAINT "admin_broadcasts_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_assistant_contexts"
    ADD CONSTRAINT "ai_assistant_contexts_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_automation_approvals"
    ADD CONSTRAINT "ai_automation_approvals_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "public"."ai_automation_actions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_automation_feedback"
    ADD CONSTRAINT "ai_automation_feedback_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "public"."ai_automation_actions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_chat_preferences"
    ADD CONSTRAINT "ai_chat_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_conversation_summaries"
    ADD CONSTRAINT "ai_conversation_summaries_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_dispatch_predictions"
    ADD CONSTRAINT "ai_dispatch_predictions_match_assignment_id_fkey" FOREIGN KEY ("match_assignment_id") REFERENCES "public"."match_assignments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_dispatch_predictions"
    ADD CONSTRAINT "ai_dispatch_predictions_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_dispatch_predictions"
    ADD CONSTRAINT "ai_dispatch_predictions_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_intent_memory"
    ADD CONSTRAINT "ai_intent_memory_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_intent_memory"
    ADD CONSTRAINT "ai_intent_memory_final_category_id_fkey" FOREIGN KEY ("final_category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_intent_memory"
    ADD CONSTRAINT "ai_intent_memory_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_job_analyses"
    ADD CONSTRAINT "ai_job_analyses_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_offer_comparisons"
    ADD CONSTRAINT "ai_offer_comparisons_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_proactive_suggestions"
    ADD CONSTRAINT "ai_proactive_suggestions_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_provider_reputation"
    ADD CONSTRAINT "ai_provider_reputation_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_vision_analyses"
    ADD CONSTRAINT "ai_vision_analyses_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_voice_transcripts"
    ADD CONSTRAINT "ai_voice_transcripts_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_analytics_events"
    ADD CONSTRAINT "booking_analytics_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_attachments"
    ADD CONSTRAINT "booking_attachments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_attachments"
    ADD CONSTRAINT "booking_attachments_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_issue_reports"
    ADD CONSTRAINT "booking_issue_reports_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_issue_reports"
    ADD CONSTRAINT "booking_issue_reports_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_issue_reports"
    ADD CONSTRAINT "booking_issue_reports_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_issue_reports"
    ADD CONSTRAINT "booking_issue_reports_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_issue_reports"
    ADD CONSTRAINT "booking_issue_reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_notes"
    ADD CONSTRAINT "booking_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_notes"
    ADD CONSTRAINT "booking_notes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_reminder_log"
    ADD CONSTRAINT "booking_reminder_log_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_slot_feedback"
    ADD CONSTRAINT "booking_slot_feedback_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_status_log"
    ADD CONSTRAINT "booking_status_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_status_log"
    ADD CONSTRAINT "booking_status_log_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_parent_booking_id_fkey" FOREIGN KEY ("parent_booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."provider_services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_goal_progress"
    ADD CONSTRAINT "business_goal_progress_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."business_goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_subscription_payments"
    ADD CONSTRAINT "business_subscription_payments_monetization_plan_id_fkey" FOREIGN KEY ("monetization_plan_id") REFERENCES "public"."provider_monetization_plans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_subscription_payments"
    ADD CONSTRAINT "business_subscription_payments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_subscription_payments"
    ADD CONSTRAINT "business_subscription_payments_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cell_policies"
    ADD CONSTRAINT "cell_policies_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cell_policies"
    ADD CONSTRAINT "cell_policies_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cell_policies"
    ADD CONSTRAINT "cell_policies_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_analytics_events"
    ADD CONSTRAINT "chat_analytics_events_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_voice_transcript_translations"
    ADD CONSTRAINT "chat_voice_transcript_translations_transcript_id_fkey" FOREIGN KEY ("transcript_id") REFERENCES "public"."chat_voice_transcripts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_release_grants"
    ADD CONSTRAINT "contact_release_grants_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_release_grants"
    ADD CONSTRAINT "contact_release_grants_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_release_grants"
    ADD CONSTRAINT "contact_release_grants_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_release_grants"
    ADD CONSTRAINT "contact_release_grants_unlock_session_id_fkey" FOREIGN KEY ("unlock_session_id") REFERENCES "public"."unlock_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_typing"
    ADD CONSTRAINT "conversation_typing_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_typing"
    ADD CONSTRAINT "conversation_typing_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credit_note_metadata"
    ADD CONSTRAINT "credit_note_metadata_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."financial_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_note_metadata"
    ADD CONSTRAINT "credit_note_metadata_original_document_id_fkey" FOREIGN KEY ("original_document_id") REFERENCES "public"."financial_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credit_note_metadata"
    ADD CONSTRAINT "credit_note_metadata_refund_request_id_fkey" FOREIGN KEY ("refund_request_id") REFERENCES "public"."refund_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_preference_profiles"
    ADD CONSTRAINT "customer_preference_profiles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dispute_evidence"
    ADD CONSTRAINT "dispute_evidence_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "public"."payment_disputes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_download_history"
    ADD CONSTRAINT "document_download_history_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."financial_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emergency_dispatch_responses"
    ADD CONSTRAINT "emergency_dispatch_responses_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "public"."emergency_dispatches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emergency_live_locations"
    ADD CONSTRAINT "emergency_live_locations_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "public"."emergency_dispatches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emergency_timeline_events"
    ADD CONSTRAINT "emergency_timeline_events_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "public"."emergency_dispatches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_documents"
    ADD CONSTRAINT "financial_documents_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."financial_documents"
    ADD CONSTRAINT "financial_documents_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_documents"
    ADD CONSTRAINT "financial_documents_regenerated_from_fkey" FOREIGN KEY ("regenerated_from") REFERENCES "public"."financial_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forecast_accuracy"
    ADD CONSTRAINT "forecast_accuracy_history_id_fkey" FOREIGN KEY ("history_id") REFERENCES "public"."forecast_history"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forecast_explanations"
    ADD CONSTRAINT "forecast_explanations_history_id_fkey" FOREIGN KEY ("history_id") REFERENCES "public"."forecast_history"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forecast_results"
    ADD CONSTRAINT "forecast_results_history_id_fkey" FOREIGN KEY ("history_id") REFERENCES "public"."forecast_history"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fraud_events"
    ADD CONSTRAINT "fraud_events_investigation_id_fkey" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."images"
    ADD CONSTRAINT "images_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."images"
    ADD CONSTRAINT "images_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."investigation_history"
    ADD CONSTRAINT "investigation_history_investigation_id_fkey" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."investigation_notes"
    ADD CONSTRAINT "investigation_notes_investigation_id_fkey" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."investigations"
    ADD CONSTRAINT "investigations_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "public"."investigations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoice_metadata"
    ADD CONSTRAINT "invoice_metadata_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."financial_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_pricing_history"
    ADD CONSTRAINT "lead_pricing_history_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lead_pricing_history"
    ADD CONSTRAINT "lead_pricing_history_unlock_session_id_fkey" FOREIGN KEY ("unlock_session_id") REFERENCES "public"."unlock_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lead_unlock_payments"
    ADD CONSTRAINT "lead_unlock_payments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_unlock_payments"
    ADD CONSTRAINT "lead_unlock_payments_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_unlock_payments"
    ADD CONSTRAINT "lead_unlock_payments_unlock_session_id_fkey" FOREIGN KEY ("unlock_session_id") REFERENCES "public"."unlock_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learning_events"
    ADD CONSTRAINT "learning_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."learning_events"
    ADD CONSTRAINT "learning_events_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."learning_events"
    ADD CONSTRAINT "learning_events_search_log_id_fkey" FOREIGN KEY ("search_log_id") REFERENCES "public"."search_logs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."learning_events"
    ADD CONSTRAINT "learning_events_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."maintenance_contracts"
    ADD CONSTRAINT "maintenance_contracts_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."recurring_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_decisions"
    ADD CONSTRAINT "marketplace_decisions_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "public"."marketplace_recommendations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_executive_reports"
    ADD CONSTRAINT "marketplace_executive_reports_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."marketplace_reports"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_notifications"
    ADD CONSTRAINT "marketplace_notifications_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_notifications"
    ADD CONSTRAINT "marketplace_notifications_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_notifications"
    ADD CONSTRAINT "marketplace_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_offers"
    ADD CONSTRAINT "marketplace_offers_match_assignment_id_fkey" FOREIGN KEY ("match_assignment_id") REFERENCES "public"."match_assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_offers"
    ADD CONSTRAINT "marketplace_offers_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_offers"
    ADD CONSTRAINT "marketplace_offers_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_offers"
    ADD CONSTRAINT "marketplace_offers_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."offer_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_request_projections"
    ADD CONSTRAINT "marketplace_request_projections_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_selections"
    ADD CONSTRAINT "marketplace_selections_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."marketplace_offers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_selections"
    ADD CONSTRAINT "marketplace_selections_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_selections"
    ADD CONSTRAINT "marketplace_selections_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_assignments"
    ADD CONSTRAINT "match_assignments_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "public"."match_pools"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_assignments"
    ADD CONSTRAINT "match_assignments_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_assignments"
    ADD CONSTRAINT "match_assignments_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_pools"
    ADD CONSTRAINT "match_pools_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matching_explanations"
    ADD CONSTRAINT "matching_explanations_score_id_fkey" FOREIGN KEY ("score_id") REFERENCES "public"."matching_scores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_objects"
    ADD CONSTRAINT "media_objects_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_processing_jobs"
    ADD CONSTRAINT "media_processing_jobs_media_object_id_fkey" FOREIGN KEY ("media_object_id") REFERENCES "public"."media_objects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_attachments"
    ADD CONSTRAINT "message_attachments_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_attachments"
    ADD CONSTRAINT "message_attachments_media_object_fkey" FOREIGN KEY ("media_object_id") REFERENCES "public"."media_objects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."message_attachments"
    ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_attachments"
    ADD CONSTRAINT "message_attachments_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_read_receipts"
    ADD CONSTRAINT "message_read_receipts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_read_receipts"
    ADD CONSTRAINT "message_read_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_reply_to_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_delivery_attempts"
    ADD CONSTRAINT "notification_delivery_attempts_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."smart_notifications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_delivery_attempts"
    ADD CONSTRAINT "notification_delivery_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_digests"
    ADD CONSTRAINT "notification_digests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_push_subscriptions"
    ADD CONSTRAINT "notification_push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offer_clarifications"
    ADD CONSTRAINT "offer_clarifications_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offer_clarifications"
    ADD CONSTRAINT "offer_clarifications_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."marketplace_offers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offer_clarifications"
    ADD CONSTRAINT "offer_clarifications_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offer_templates"
    ADD CONSTRAINT "offer_templates_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_disputes"
    ADD CONSTRAINT "payment_disputes_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payment_disputes"
    ADD CONSTRAINT "payment_disputes_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payment_events"
    ADD CONSTRAINT "payment_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payment_events"
    ADD CONSTRAINT "payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_status_snapshots"
    ADD CONSTRAINT "payment_status_snapshots_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_webhook_events"
    ADD CONSTRAINT "payment_webhook_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_unlock_session_id_fkey" FOREIGN KEY ("unlock_session_id") REFERENCES "public"."unlock_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pdf_generation_logs"
    ADD CONSTRAINT "pdf_generation_logs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."financial_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_alerts"
    ADD CONSTRAINT "platform_alerts_anomaly_id_fkey" FOREIGN KEY ("anomaly_id") REFERENCES "public"."platform_anomalies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_ops_tasks"
    ADD CONSTRAINT "platform_ops_tasks_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "public"."platform_alerts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pricing_explanations"
    ADD CONSTRAINT "pricing_explanations_history_id_fkey" FOREIGN KEY ("history_id") REFERENCES "public"."pricing_history"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_feedback"
    ADD CONSTRAINT "pricing_feedback_history_id_fkey" FOREIGN KEY ("history_id") REFERENCES "public"."pricing_history"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_activity_events"
    ADD CONSTRAINT "project_activity_events_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."project_packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_activity_events"
    ADD CONSTRAINT "project_activity_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."service_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_approvals"
    ADD CONSTRAINT "project_approvals_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."project_packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_approvals"
    ADD CONSTRAINT "project_approvals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."service_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_checklist_items"
    ADD CONSTRAINT "project_checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "public"."project_checklists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_checklists"
    ADD CONSTRAINT "project_checklists_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."project_packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_checklists"
    ADD CONSTRAINT "project_checklists_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."service_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_document_versions"
    ADD CONSTRAINT "project_document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."project_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_document_versions"
    ADD CONSTRAINT "project_document_versions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."service_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_documents"
    ADD CONSTRAINT "project_documents_media_object_fkey" FOREIGN KEY ("media_object_id") REFERENCES "public"."media_objects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_documents"
    ADD CONSTRAINT "project_documents_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."project_packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_documents"
    ADD CONSTRAINT "project_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."service_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_packages"
    ADD CONSTRAINT "project_packages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."service_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_tasks"
    ADD CONSTRAINT "project_tasks_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."project_packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_tasks"
    ADD CONSTRAINT "project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."service_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_timeline_events"
    ADD CONSTRAINT "project_timeline_events_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."project_packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_timeline_events"
    ADD CONSTRAINT "project_timeline_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."service_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_availability_breaks"
    ADD CONSTRAINT "provider_availability_breaks_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_availability_settings"
    ADD CONSTRAINT "provider_availability_settings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_blocked_times"
    ADD CONSTRAINT "provider_blocked_times_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."provider_blocked_times"
    ADD CONSTRAINT "provider_blocked_times_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_engagement_events"
    ADD CONSTRAINT "provider_engagement_events_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_engagement_events"
    ADD CONSTRAINT "provider_engagement_events_search_log_id_fkey" FOREIGN KEY ("search_log_id") REFERENCES "public"."search_logs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."provider_engagement_events"
    ADD CONSTRAINT "provider_engagement_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."provider_monetization_plans"
    ADD CONSTRAINT "provider_monetization_plans_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_monthly_unlock_usage"
    ADD CONSTRAINT "provider_monthly_unlock_usage_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_opportunities"
    ADD CONSTRAINT "provider_opportunities_gap_id_fkey" FOREIGN KEY ("gap_id") REFERENCES "public"."provider_schedule_gaps"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."provider_opportunity_history"
    ADD CONSTRAINT "provider_opportunity_history_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."provider_opportunities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."provider_performance_scores"
    ADD CONSTRAINT "provider_performance_scores_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_reputation_cache"
    ADD CONSTRAINT "provider_reputation_cache_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_reputation_events"
    ADD CONSTRAINT "provider_reputation_events_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_reputation_explanations"
    ADD CONSTRAINT "provider_reputation_explanations_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_reputation_history"
    ADD CONSTRAINT "provider_reputation_history_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_reputation_scores"
    ADD CONSTRAINT "provider_reputation_scores_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_reputation_signals"
    ADD CONSTRAINT "provider_reputation_signals_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_request_settings"
    ADD CONSTRAINT "provider_request_settings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_services"
    ADD CONSTRAINT "provider_services_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_verification_checks"
    ADD CONSTRAINT "provider_verification_checks_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_verification_checks"
    ADD CONSTRAINT "provider_verification_checks_type_slug_fkey" FOREIGN KEY ("type_slug") REFERENCES "public"."verification_types"("slug") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_verifications"
    ADD CONSTRAINT "provider_verifications_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_verifications"
    ADD CONSTRAINT "provider_verifications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."provider_working_hours"
    ADD CONSTRAINT "provider_working_hours_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_avatar_image_id_fkey" FOREIGN KEY ("avatar_image_id") REFERENCES "public"."images"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_cover_image_id_fkey" FOREIGN KEY ("cover_image_id") REFERENCES "public"."images"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quality_case_ai_analysis"
    ADD CONSTRAINT "quality_case_ai_analysis_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."quality_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quality_case_assignments"
    ADD CONSTRAINT "quality_case_assignments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."quality_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quality_case_evidence"
    ADD CONSTRAINT "quality_case_evidence_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."quality_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quality_case_history"
    ADD CONSTRAINT "quality_case_history_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."quality_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quality_case_messages"
    ADD CONSTRAINT "quality_case_messages_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."quality_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quality_case_metrics"
    ADD CONSTRAINT "quality_case_metrics_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quality_cases"
    ADD CONSTRAINT "quality_cases_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quality_cases"
    ADD CONSTRAINT "quality_cases_merged_into_case_id_fkey" FOREIGN KEY ("merged_into_case_id") REFERENCES "public"."quality_cases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quality_cases"
    ADD CONSTRAINT "quality_cases_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quote_items"
    ADD CONSTRAINT "quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receipt_metadata"
    ADD CONSTRAINT "receipt_metadata_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."financial_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_reminder_log"
    ADD CONSTRAINT "recurring_reminder_log_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."recurring_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_reminder_log"
    ADD CONSTRAINT "recurring_reminder_log_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "public"."recurring_visits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_visits"
    ADD CONSTRAINT "recurring_visits_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."recurring_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."refund_history"
    ADD CONSTRAINT "refund_history_refund_request_id_fkey" FOREIGN KEY ("refund_request_id") REFERENCES "public"."refund_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_ai_analysis"
    ADD CONSTRAINT "review_ai_analysis_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."service_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_flags"
    ADD CONSTRAINT "review_flags_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."service_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_media"
    ADD CONSTRAINT "review_media_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."service_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_moderation"
    ADD CONSTRAINT "review_moderation_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."service_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_ratings"
    ADD CONSTRAINT "review_ratings_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."service_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_responses"
    ADD CONSTRAINT "review_responses_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_responses"
    ADD CONSTRAINT "review_responses_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."service_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_explanations"
    ADD CONSTRAINT "schedule_explanations_history_id_fkey" FOREIGN KEY ("history_id") REFERENCES "public"."schedule_history"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_recommendations"
    ADD CONSTRAINT "schedule_recommendations_history_id_fkey" FOREIGN KEY ("history_id") REFERENCES "public"."schedule_history"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."search_logs"
    ADD CONSTRAINT "search_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_request_images"
    ADD CONSTRAINT "service_request_images_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_selection_id_fkey" FOREIGN KEY ("selection_id") REFERENCES "public"."marketplace_selections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_review_helpful_votes"
    ADD CONSTRAINT "service_review_helpful_votes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."service_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_review_helpful_votes"
    ADD CONSTRAINT "service_review_helpful_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_review_images"
    ADD CONSTRAINT "service_review_images_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."service_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_reviews"
    ADD CONSTRAINT "service_reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_reviews"
    ADD CONSTRAINT "service_reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_reviews"
    ADD CONSTRAINT "service_reviews_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_reviews"
    ADD CONSTRAINT "service_reviews_provider_reply_by_fkey" FOREIGN KEY ("provider_reply_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_reviews"
    ADD CONSTRAINT "service_reviews_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."smart_notifications"
    ADD CONSTRAINT "smart_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unlock_reliability_signals"
    ADD CONSTRAINT "unlock_reliability_signals_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unlock_reliability_signals"
    ADD CONSTRAINT "unlock_reliability_signals_unlock_session_id_fkey" FOREIGN KEY ("unlock_session_id") REFERENCES "public"."unlock_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unlock_sessions"
    ADD CONSTRAINT "unlock_sessions_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."marketplace_offers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."unlock_sessions"
    ADD CONSTRAINT "unlock_sessions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."unlock_sessions"
    ADD CONSTRAINT "unlock_sessions_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unlock_sessions"
    ADD CONSTRAINT "unlock_sessions_selection_id_fkey" FOREIGN KEY ("selection_id") REFERENCES "public"."marketplace_selections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unlock_sessions"
    ADD CONSTRAINT "unlock_sessions_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_presence"
    ADD CONSTRAINT "user_presence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_storage_usage"
    ADD CONSTRAINT "user_storage_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_preferred_city_id_fkey" FOREIGN KEY ("preferred_city_id") REFERENCES "public"."cities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."verification_types"
    ADD CONSTRAINT "verification_types_level_slug_fkey" FOREIGN KEY ("level_slug") REFERENCES "public"."verification_levels"("slug") ON DELETE CASCADE;



ALTER TABLE "public"."admin_action_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_action_logs_insert" ON "public"."admin_action_logs" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_role"('admin'::"public"."app_role") OR "public"."has_role"('moderator'::"public"."app_role")));



CREATE POLICY "admin_action_logs_select" ON "public"."admin_action_logs" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR "public"."has_role"('moderator'::"public"."app_role")));



ALTER TABLE "public"."admin_broadcasts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_broadcasts_admin_all" ON "public"."admin_broadcasts" TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR "public"."has_role"('moderator'::"public"."app_role"))) WITH CHECK (("public"."has_role"('admin'::"public"."app_role") OR "public"."has_role"('moderator'::"public"."app_role")));



ALTER TABLE "public"."ai_assistant_contexts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_assistant_contexts_select_admin" ON "public"."ai_assistant_contexts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



CREATE POLICY "ai_assistant_contexts_select_customer" ON "public"."ai_assistant_contexts" FOR SELECT USING ((("audience" = 'customer'::"text") AND ("service_request_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."service_requests" "sr"
  WHERE (("sr"."id" = "ai_assistant_contexts"."service_request_id") AND ("sr"."customer_id" = "auth"."uid"()))))));



ALTER TABLE "public"."ai_automation_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_automation_actions_select_admin" ON "public"."ai_automation_actions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



CREATE POLICY "ai_automation_actions_self" ON "public"."ai_automation_actions" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."ai_automation_approvals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_automation_approvals_select_admin" ON "public"."ai_automation_approvals" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



CREATE POLICY "ai_automation_approvals_self" ON "public"."ai_automation_approvals" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."ai_automation_feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_automation_feedback_select_admin" ON "public"."ai_automation_feedback" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



ALTER TABLE "public"."ai_automation_policies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_automation_policies_select_admin" ON "public"."ai_automation_policies" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



ALTER TABLE "public"."ai_availability_forecasts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_availability_forecasts_select_admin" ON "public"."ai_availability_forecasts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



ALTER TABLE "public"."ai_chat_action_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_chat_action_items_participant_insert" ON "public"."ai_chat_action_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_conversation_participant"("conversation_id", "auth"."uid"()));



CREATE POLICY "ai_chat_action_items_participant_select" ON "public"."ai_chat_action_items" FOR SELECT TO "authenticated" USING ((("deleted_at" IS NULL) AND "public"."is_conversation_participant"("conversation_id", "auth"."uid"())));



CREATE POLICY "ai_chat_action_items_participant_update" ON "public"."ai_chat_action_items" FOR UPDATE TO "authenticated" USING ("public"."is_conversation_participant"("conversation_id", "auth"."uid"())) WITH CHECK ("public"."is_conversation_participant"("conversation_id", "auth"."uid"()));



ALTER TABLE "public"."ai_chat_extractions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_chat_extractions_participant_select" ON "public"."ai_chat_extractions" FOR SELECT TO "authenticated" USING ((("deleted_at" IS NULL) AND "public"."is_conversation_participant"("conversation_id", "auth"."uid"())));



CREATE POLICY "ai_chat_extractions_participant_update" ON "public"."ai_chat_extractions" FOR UPDATE TO "authenticated" USING ("public"."is_conversation_participant"("conversation_id", "auth"."uid"())) WITH CHECK ("public"."is_conversation_participant"("conversation_id", "auth"."uid"()));



CREATE POLICY "ai_chat_extractions_participant_write" ON "public"."ai_chat_extractions" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_conversation_participant"("conversation_id", "auth"."uid"()));



ALTER TABLE "public"."ai_chat_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_chat_preferences_self" ON "public"."ai_chat_preferences" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."ai_chat_sentiment" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_chat_sentiment_participant_insert" ON "public"."ai_chat_sentiment" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_conversation_participant"("conversation_id", "auth"."uid"()));



CREATE POLICY "ai_chat_sentiment_participant_select" ON "public"."ai_chat_sentiment" FOR SELECT TO "authenticated" USING ("public"."is_conversation_participant"("conversation_id", "auth"."uid"()));



ALTER TABLE "public"."ai_chat_translations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_chat_translations_participant_insert" ON "public"."ai_chat_translations" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_conversation_participant"("conversation_id", "auth"."uid"()));



CREATE POLICY "ai_chat_translations_participant_select" ON "public"."ai_chat_translations" FOR SELECT TO "authenticated" USING ("public"."is_conversation_participant"("conversation_id", "auth"."uid"()));



ALTER TABLE "public"."ai_conversation_summaries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_conversation_summaries_select_admin" ON "public"."ai_conversation_summaries" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



ALTER TABLE "public"."ai_demand_forecasts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_demand_forecasts_select_admin" ON "public"."ai_demand_forecasts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



ALTER TABLE "public"."ai_dispatch_predictions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_dispatch_predictions_select_admin" ON "public"."ai_dispatch_predictions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



ALTER TABLE "public"."ai_intent_decisions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_intent_decisions_select_admin" ON "public"."ai_intent_decisions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



ALTER TABLE "public"."ai_intent_memory" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_intent_memory_select_admin" ON "public"."ai_intent_memory" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



ALTER TABLE "public"."ai_job_analyses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_job_analyses_select_admin" ON "public"."ai_job_analyses" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



CREATE POLICY "ai_job_analyses_select_assigned_provider" ON "public"."ai_job_analyses" FOR SELECT USING ((("service_request_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ("public"."match_assignments" "ma"
     JOIN "public"."providers" "p" ON (("p"."id" = "ma"."provider_id")))
  WHERE (("ma"."service_request_id" = "ai_job_analyses"."service_request_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL))))));



ALTER TABLE "public"."ai_knowledge_phrases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_knowledge_phrases_select_admin" ON "public"."ai_knowledge_phrases" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



ALTER TABLE "public"."ai_marketplace_balances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_marketplace_balances_select_admin" ON "public"."ai_marketplace_balances" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



ALTER TABLE "public"."ai_marketplace_path_stats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_marketplace_path_stats_select_admin" ON "public"."ai_marketplace_path_stats" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



ALTER TABLE "public"."ai_offer_comparisons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_offer_comparisons_select_admin" ON "public"."ai_offer_comparisons" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



CREATE POLICY "ai_offer_comparisons_select_customer" ON "public"."ai_offer_comparisons" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."service_requests" "sr"
  WHERE (("sr"."id" = "ai_offer_comparisons"."service_request_id") AND ("sr"."customer_id" = "auth"."uid"())))));



ALTER TABLE "public"."ai_prediction_outcomes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_prediction_outcomes_select_admin" ON "public"."ai_prediction_outcomes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



ALTER TABLE "public"."ai_predictive_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_predictive_notifications_select_admin" ON "public"."ai_predictive_notifications" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



ALTER TABLE "public"."ai_proactive_suggestions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_proactive_suggestions_select_admin" ON "public"."ai_proactive_suggestions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



CREATE POLICY "ai_proactive_suggestions_select_customer" ON "public"."ai_proactive_suggestions" FOR SELECT USING ((("audience" = 'customer'::"text") AND ("customer_id" = "auth"."uid"())));



CREATE POLICY "ai_proactive_suggestions_select_provider" ON "public"."ai_proactive_suggestions" FOR SELECT USING ((("audience" = 'provider'::"text") AND ("provider_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "ai_proactive_suggestions"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL))))));



ALTER TABLE "public"."ai_provider_automation_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_provider_automation_settings_owner" ON "public"."ai_provider_automation_settings" USING ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "ai_provider_automation_settings"."provider_id") AND ("p"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "ai_provider_automation_settings"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))));



CREATE POLICY "ai_provider_automation_settings_select_admin" ON "public"."ai_provider_automation_settings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



ALTER TABLE "public"."ai_provider_reputation" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_provider_reputation_select_admin" ON "public"."ai_provider_reputation" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



CREATE POLICY "ai_provider_reputation_select_owner" ON "public"."ai_provider_reputation" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "ai_provider_reputation"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL)))));



ALTER TABLE "public"."ai_service_knowledge" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_service_knowledge_select_authenticated" ON "public"."ai_service_knowledge" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."ai_vision_analyses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_vision_analyses_select_admin" ON "public"."ai_vision_analyses" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



CREATE POLICY "ai_vision_analyses_select_assigned_provider" ON "public"."ai_vision_analyses" FOR SELECT USING ((("service_request_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ("public"."match_assignments" "ma"
     JOIN "public"."providers" "p" ON (("p"."id" = "ma"."provider_id")))
  WHERE (("ma"."service_request_id" = "ai_vision_analyses"."service_request_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL))))));



ALTER TABLE "public"."ai_voice_transcripts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_voice_transcripts_select_admin" ON "public"."ai_voice_transcripts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



CREATE POLICY "ai_voice_transcripts_select_assigned_provider" ON "public"."ai_voice_transcripts" FOR SELECT USING ((("service_request_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ("public"."match_assignments" "ma"
     JOIN "public"."providers" "p" ON (("p"."id" = "ma"."provider_id")))
  WHERE (("ma"."service_request_id" = "ai_voice_transcripts"."service_request_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL))))));



ALTER TABLE "public"."ai_wait_time_estimates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_wait_time_estimates_select_admin" ON "public"."ai_wait_time_estimates" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_select_admin" ON "public"."audit_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



CREATE POLICY "availability_breaks_owner" ON "public"."provider_availability_breaks" TO "authenticated" USING ("public"."is_provider_owner"("provider_id", "auth"."uid"())) WITH CHECK ("public"."is_provider_owner"("provider_id", "auth"."uid"()));



CREATE POLICY "availability_breaks_select" ON "public"."provider_availability_breaks" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "availability_settings_owner" ON "public"."provider_availability_settings" TO "authenticated" USING ("public"."is_provider_owner"("provider_id", "auth"."uid"())) WITH CHECK ("public"."is_provider_owner"("provider_id", "auth"."uid"()));



CREATE POLICY "availability_settings_select" ON "public"."provider_availability_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "blocked_times_owner" ON "public"."provider_blocked_times" TO "authenticated" USING ("public"."is_provider_owner"("provider_id", "auth"."uid"())) WITH CHECK ("public"."is_provider_owner"("provider_id", "auth"."uid"()));



CREATE POLICY "blocked_times_select" ON "public"."provider_blocked_times" FOR SELECT TO "authenticated" USING (("deleted_at" IS NULL));



CREATE POLICY "booking_analytics_admin" ON "public"."booking_analytics_events" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."booking_analytics_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "booking_attachments_insert" ON "public"."booking_attachments" FOR INSERT TO "authenticated" WITH CHECK ((("uploader_id" = "auth"."uid"()) AND "public"."is_booking_participant"("booking_id", "auth"."uid"())));



CREATE POLICY "booking_attachments_select" ON "public"."booking_attachments" FOR SELECT TO "authenticated" USING ((("deleted_at" IS NULL) AND "public"."is_booking_participant"("booking_id", "auth"."uid"())));



ALTER TABLE "public"."booking_issue_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "booking_issue_reports_insert" ON "public"."booking_issue_reports" FOR INSERT TO "authenticated" WITH CHECK (("customer_id" = "auth"."uid"()));



CREATE POLICY "booking_issue_reports_select" ON "public"."booking_issue_reports" FOR SELECT TO "authenticated" USING ((("deleted_at" IS NULL) AND (("customer_id" = "auth"."uid"()) OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE (("providers"."owner_id" = "auth"."uid"()) AND ("providers"."deleted_at" IS NULL)))) OR "public"."has_role"('admin'::"public"."app_role") OR "public"."has_role"('moderator'::"public"."app_role"))));



CREATE POLICY "booking_issue_reports_soft_delete" ON "public"."booking_issue_reports" FOR UPDATE TO "authenticated" USING ((("customer_id" = "auth"."uid"()) OR "public"."has_role"('admin'::"public"."app_role") OR "public"."has_role"('moderator'::"public"."app_role"))) WITH CHECK (true);



ALTER TABLE "public"."booking_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "booking_notes_insert" ON "public"."booking_notes" FOR INSERT TO "authenticated" WITH CHECK ((("author_id" = "auth"."uid"()) AND "public"."is_booking_participant"("booking_id", "auth"."uid"())));



CREATE POLICY "booking_notes_select" ON "public"."booking_notes" FOR SELECT TO "authenticated" USING ((("deleted_at" IS NULL) AND "public"."is_booking_participant"("booking_id", "auth"."uid"()) AND (("is_internal" = false) OR (EXISTS ( SELECT 1
   FROM ("public"."bookings" "b"
     JOIN "public"."providers" "pr" ON (("pr"."id" = "b"."provider_id")))
  WHERE (("b"."id" = "booking_notes"."booking_id") AND ("pr"."owner_id" = "auth"."uid"())))))));



ALTER TABLE "public"."booking_reminder_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "booking_reminder_log_select" ON "public"."booking_reminder_log" FOR SELECT TO "authenticated" USING (("public"."is_booking_participant"("booking_id", "auth"."uid"()) OR "public"."has_role"('admin'::"public"."app_role")));



ALTER TABLE "public"."booking_slot_feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "booking_slot_feedback_select_admin" ON "public"."booking_slot_feedback" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



ALTER TABLE "public"."booking_status_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "booking_status_log_select" ON "public"."booking_status_log" FOR SELECT TO "authenticated" USING (("public"."is_booking_participant"("booking_id", "auth"."uid"()) OR "public"."has_role"('admin'::"public"."app_role")));



ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bookings_insert_customer" ON "public"."bookings" FOR INSERT TO "authenticated" WITH CHECK (("customer_id" = "auth"."uid"()));



CREATE POLICY "bookings_select" ON "public"."bookings" FOR SELECT TO "authenticated" USING ((("deleted_at" IS NULL) AND (("customer_id" = "auth"."uid"()) OR "public"."is_provider_owner"("provider_id", "auth"."uid"()) OR "public"."has_role"('admin'::"public"."app_role") OR "public"."has_role"('moderator'::"public"."app_role"))));



CREATE POLICY "bookings_update_participants" ON "public"."bookings" FOR UPDATE TO "authenticated" USING ((("customer_id" = "auth"."uid"()) OR "public"."is_provider_owner"("provider_id", "auth"."uid"()) OR "public"."has_role"('admin'::"public"."app_role"))) WITH CHECK ((("customer_id" = "auth"."uid"()) OR "public"."is_provider_owner"("provider_id", "auth"."uid"()) OR "public"."has_role"('admin'::"public"."app_role")));



ALTER TABLE "public"."business_assistant_experiments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_assistant_experiments_admin" ON "public"."business_assistant_experiments" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."business_benchmarks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_benchmarks_select" ON "public"."business_benchmarks" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."business_briefings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_briefings_select" ON "public"."business_briefings" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."business_goal_progress" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_goal_progress_rw" ON "public"."business_goal_progress" TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"()))))) WITH CHECK (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."business_goals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_goals_rw" ON "public"."business_goals" TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"()))))) WITH CHECK (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."business_health" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_health_select" ON "public"."business_health" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."business_insights" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_insights_select" ON "public"."business_insights" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."business_recommendations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_recs_rw" ON "public"."business_recommendations" TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"()))))) WITH CHECK (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"())))));



CREATE POLICY "business_sub_payments_own" ON "public"."business_subscription_payments" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "business_subscription_payments"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))) OR "public"."has_role"('admin'::"public"."app_role")));



ALTER TABLE "public"."business_subscription_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."capacity_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "capacity_history_select" ON "public"."capacity_history" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"())))));



CREATE POLICY "capacity_pred_select" ON "public"."capacity_predictions" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."capacity_predictions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_admin_manage" ON "public"."categories" USING (("public"."has_role"('admin'::"public"."app_role") OR "public"."has_role"('moderator'::"public"."app_role"))) WITH CHECK (("public"."has_role"('admin'::"public"."app_role") OR "public"."has_role"('moderator'::"public"."app_role")));



CREATE POLICY "categories_public_read" ON "public"."categories" FOR SELECT USING (("deleted_at" IS NULL));



ALTER TABLE "public"."category_health" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "category_health_admin" ON "public"."category_health" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."cell_policies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_analytics_deny_select" ON "public"."chat_analytics_events" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."chat_analytics_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_voice_tr_participant_insert" ON "public"."chat_voice_transcript_translations" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_conversation_participant"("conversation_id", "auth"."uid"()));



CREATE POLICY "chat_voice_tr_participant_select" ON "public"."chat_voice_transcript_translations" FOR SELECT TO "authenticated" USING ("public"."is_conversation_participant"("conversation_id", "auth"."uid"()));



ALTER TABLE "public"."chat_voice_transcript_translations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_voice_transcripts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_voice_transcripts_participant_insert" ON "public"."chat_voice_transcripts" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_conversation_participant"("conversation_id", "auth"."uid"()));



CREATE POLICY "chat_voice_transcripts_participant_select" ON "public"."chat_voice_transcripts" FOR SELECT TO "authenticated" USING ((("deleted_at" IS NULL) AND "public"."is_conversation_participant"("conversation_id", "auth"."uid"())));



CREATE POLICY "chat_voice_transcripts_participant_update" ON "public"."chat_voice_transcripts" FOR UPDATE TO "authenticated" USING ("public"."is_conversation_participant"("conversation_id", "auth"."uid"())) WITH CHECK ("public"."is_conversation_participant"("conversation_id", "auth"."uid"()));



ALTER TABLE "public"."cities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cities_public_read" ON "public"."cities" FOR SELECT USING (true);



CREATE POLICY "company_billing_admin" ON "public"."company_billing_settings" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "company_billing_read" ON "public"."company_billing_settings" FOR SELECT TO "authenticated" USING (("is_active" = true));



ALTER TABLE "public"."company_billing_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_release_grants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contact_release_grants_select" ON "public"."contact_release_grants" FOR SELECT TO "authenticated" USING ((("customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "contact_release_grants"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'moderator'::"public"."app_role"])))))));



ALTER TABLE "public"."conversation_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversation_participants_select" ON "public"."conversation_participants" FOR SELECT TO "authenticated" USING ("public"."is_conversation_participant"("conversation_id", "auth"."uid"()));



CREATE POLICY "conversation_participants_update_self" ON "public"."conversation_participants" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."conversation_typing" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversation_typing_select" ON "public"."conversation_typing" FOR SELECT TO "authenticated" USING ((("expires_at" > "now"()) AND "public"."is_conversation_participant"("conversation_id", "auth"."uid"())));



ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversations_participant_select" ON "public"."conversations" FOR SELECT TO "authenticated" USING ((("deleted_at" IS NULL) AND "public"."is_conversation_participant"("id", "auth"."uid"())));



CREATE POLICY "conversations_participant_update" ON "public"."conversations" FOR UPDATE TO "authenticated" USING ("public"."is_conversation_participant"("id", "auth"."uid"())) WITH CHECK ("public"."is_conversation_participant"("id", "auth"."uid"()));



CREATE POLICY "credit_note_meta_own" ON "public"."credit_note_metadata" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM ("public"."financial_documents" "fd"
     JOIN "public"."providers" "p" ON (("p"."id" = "fd"."provider_id")))
  WHERE (("fd"."id" = "credit_note_metadata"."document_id") AND ("p"."owner_id" = "auth"."uid"()))))));



ALTER TABLE "public"."credit_note_metadata" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_preference_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_prefs_own" ON "public"."customer_preferences" TO "authenticated" USING ((("customer_id" = "auth"."uid"()) OR "public"."has_role"('admin'::"public"."app_role"))) WITH CHECK ((("customer_id" = "auth"."uid"()) OR "public"."has_role"('admin'::"public"."app_role")));



CREATE POLICY "customer_prefs_select_own_or_admin" ON "public"."customer_preference_profiles" FOR SELECT USING ((("customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL))))));



ALTER TABLE "public"."dispute_evidence" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dispute_evidence_own" ON "public"."dispute_evidence" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM ("public"."payment_disputes" "d"
     JOIN "public"."providers" "p" ON (("p"."id" = "d"."provider_id")))
  WHERE (("d"."id" = "dispute_evidence"."dispute_id") AND ("p"."owner_id" = "auth"."uid"()))))));



ALTER TABLE "public"."document_download_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_number_sequences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "download_history_admin" ON "public"."document_download_history" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."emergency_dispatch_responses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "emergency_dispatch_responses_select_admin" ON "public"."emergency_dispatch_responses" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



ALTER TABLE "public"."emergency_dispatches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "emergency_dispatches_customer" ON "public"."emergency_dispatches" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."service_requests" "sr"
  WHERE (("sr"."id" = "emergency_dispatches"."service_request_id") AND ("sr"."customer_id" = "auth"."uid"())))));



CREATE POLICY "emergency_dispatches_select_admin" ON "public"."emergency_dispatches" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



ALTER TABLE "public"."emergency_live_locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "emergency_live_locations_customer" ON "public"."emergency_live_locations" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."service_requests" "sr"
  WHERE (("sr"."id" = "emergency_live_locations"."service_request_id") AND ("sr"."customer_id" = "auth"."uid"())))) AND ("sharing_enabled" = true)));



CREATE POLICY "emergency_live_locations_provider" ON "public"."emergency_live_locations" USING ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "emergency_live_locations"."provider_id") AND ("p"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "emergency_live_locations"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))));



CREATE POLICY "emergency_live_locations_select_admin" ON "public"."emergency_live_locations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



CREATE POLICY "emergency_responses_provider" ON "public"."emergency_dispatch_responses" USING ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "emergency_dispatch_responses"."provider_id") AND ("p"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "emergency_dispatch_responses"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))));



CREATE POLICY "emergency_timeline_customer" ON "public"."emergency_timeline_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."service_requests" "sr"
  WHERE (("sr"."id" = "emergency_timeline_events"."service_request_id") AND ("sr"."customer_id" = "auth"."uid"())))));



ALTER TABLE "public"."emergency_timeline_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "emergency_timeline_events_select_admin" ON "public"."emergency_timeline_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



ALTER TABLE "public"."entity_relationships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "entity_relationships_admin" ON "public"."entity_relationships" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."finance_analytics_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "finance_analytics_cache_admin" ON "public"."finance_analytics_cache" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."financial_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financial_documents_own" ON "public"."financial_documents" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "financial_documents"."provider_id") AND ("p"."owner_id" = "auth"."uid"()))))));



ALTER TABLE "public"."forecast_accuracy" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "forecast_accuracy_admin" ON "public"."forecast_accuracy" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."forecast_experiments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "forecast_experiments_admin" ON "public"."forecast_experiments" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."forecast_explanations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "forecast_explanations_select" ON "public"."forecast_explanations" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."forecast_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "forecast_history_admin" ON "public"."forecast_history" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."forecast_market_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forecast_models" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "forecast_models_admin" ON "public"."forecast_models" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."forecast_results" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "forecast_results_select" ON "public"."forecast_results" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"()))) OR ("provider_id" IS NULL)));



ALTER TABLE "public"."forecast_signal_weights" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "forecast_snapshots_admin" ON "public"."forecast_market_snapshots" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "forecast_snapshots_select" ON "public"."forecast_market_snapshots" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "forecast_weights_admin" ON "public"."forecast_signal_weights" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."fraud_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fraud_events_admin" ON "public"."fraud_events" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."images" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "images_owner_all" ON "public"."images" USING ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "images"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "images"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL)))));



CREATE POLICY "images_public_gallery_read" ON "public"."images" FOR SELECT USING (((("kind")::"text" = 'gallery'::"text") AND ("deleted_at" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "images"."provider_id") AND ("p"."status" = 'active'::"public"."provider_status") AND ("p"."deleted_at" IS NULL))))));



ALTER TABLE "public"."investigation_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "investigation_history_admin_insert" ON "public"."investigation_history" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "investigation_history_admin_select" ON "public"."investigation_history" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."investigation_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "investigation_notes_admin" ON "public"."investigation_notes" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."investigations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "investigations_admin" ON "public"."investigations" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."invoice_metadata" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoice_metadata_own" ON "public"."invoice_metadata" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM ("public"."financial_documents" "d"
     JOIN "public"."providers" "p" ON (("p"."id" = "d"."provider_id")))
  WHERE (("d"."id" = "invoice_metadata"."document_id") AND ("p"."owner_id" = "auth"."uid"()))))));



ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices_select_own" ON "public"."invoices" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "invoices"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL)))));



ALTER TABLE "public"."lead_pricing_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead_pricing_own_select" ON "public"."lead_pricing_history" FOR SELECT TO "authenticated" USING ((("provider_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "lead_pricing_history"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))) OR "public"."has_role"('admin'::"public"."app_role")));



ALTER TABLE "public"."lead_unlock_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead_unlock_payments_own" ON "public"."lead_unlock_payments" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "lead_unlock_payments"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))) OR "public"."has_role"('admin'::"public"."app_role")));



ALTER TABLE "public"."learning_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "learning_events_insert_authenticated" ON "public"."learning_events" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" IS NULL) OR ("customer_id" = "auth"."uid"())));



CREATE POLICY "learning_events_select_admin" ON "public"."learning_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



ALTER TABLE "public"."maintenance_contracts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "maintenance_contracts_customer" ON "public"."maintenance_contracts" FOR SELECT USING (("customer_id" = "auth"."uid"()));



CREATE POLICY "marketplace_algo_admin" ON "public"."marketplace_algorithm_versions" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."marketplace_algorithm_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketplace_cat_admin" ON "public"."marketplace_category_metrics" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."marketplace_category_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketplace_decisions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketplace_decisions_admin" ON "public"."marketplace_decisions" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "marketplace_exec_admin" ON "public"."marketplace_executive_reports" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."marketplace_executive_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketplace_heat_admin" ON "public"."marketplace_heatmaps" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."marketplace_heatmaps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketplace_intel_admin" ON "public"."marketplace_intelligence" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."marketplace_intelligence" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketplace_kg_admin" ON "public"."marketplace_knowledge_graph" TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") AND ("internal_only" = true))) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."marketplace_knowledge_graph" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketplace_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketplace_notifications_own" ON "public"."marketplace_notifications" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "marketplace_notifications_own_update" ON "public"."marketplace_notifications" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."marketplace_offers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketplace_offers_provider_insert" ON "public"."marketplace_offers" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."providers" "p"
     JOIN "public"."match_assignments" "ma" ON (("ma"."provider_id" = "p"."id")))
  WHERE (("p"."id" = "marketplace_offers"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("ma"."id" = "marketplace_offers"."match_assignment_id") AND ("ma"."service_request_id" = "marketplace_offers"."service_request_id") AND ("ma"."provider_id" = "marketplace_offers"."provider_id")))));



CREATE POLICY "marketplace_offers_provider_update" ON "public"."marketplace_offers" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "marketplace_offers"."provider_id") AND ("p"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "marketplace_offers"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))));



CREATE POLICY "marketplace_offers_select" ON "public"."marketplace_offers" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."service_requests" "sr"
  WHERE (("sr"."id" = "marketplace_offers"."service_request_id") AND ("sr"."customer_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "marketplace_offers"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'moderator'::"public"."app_role"])))))));



CREATE POLICY "marketplace_opp_admin" ON "public"."marketplace_opportunities" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."marketplace_opportunities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketplace_projections_select" ON "public"."marketplace_request_projections" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."service_requests" "sr"
  WHERE (("sr"."id" = "marketplace_request_projections"."service_request_id") AND (("sr"."customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."providers" "p"
          WHERE (("p"."id" = "sr"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'moderator'::"public"."app_role"]))))))))));



CREATE POLICY "marketplace_projections_upsert" ON "public"."marketplace_request_projections" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."service_requests" "sr"
  WHERE (("sr"."id" = "marketplace_request_projections"."service_request_id") AND (("sr"."customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."providers" "p"
          WHERE (("p"."id" = "sr"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'moderator'::"public"."app_role"])))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."service_requests" "sr"
  WHERE (("sr"."id" = "marketplace_request_projections"."service_request_id") AND (("sr"."customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."providers" "p"
          WHERE (("p"."id" = "sr"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'moderator'::"public"."app_role"]))))))))));



ALTER TABLE "public"."marketplace_recommendations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketplace_recs_access" ON "public"."marketplace_recommendations" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR (("audience" = 'provider'::"text") AND ("subject_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"())))) OR (("audience" = 'customer'::"text") AND ("subject_id" = "auth"."uid"()))));



CREATE POLICY "marketplace_recs_admin_write" ON "public"."marketplace_recommendations" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "marketplace_region_admin" ON "public"."marketplace_region_metrics" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."marketplace_region_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketplace_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketplace_reports_admin" ON "public"."marketplace_reports" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."marketplace_request_projections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketplace_selections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketplace_selections_select" ON "public"."marketplace_selections" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "marketplace_selections"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL)))) OR (EXISTS ( SELECT 1
   FROM "public"."service_requests" "sr"
  WHERE (("sr"."id" = "marketplace_selections"."service_request_id") AND (("sr"."customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."providers" "p"
          WHERE (("p"."id" = "sr"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL)))) OR (EXISTS ( SELECT 1
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'moderator'::"public"."app_role"])) AND ("ur"."revoked_at" IS NULL))))))))));



CREATE POLICY "marketplace_sims_admin" ON "public"."marketplace_simulations" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."marketplace_simulations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "match_assignments_customer_select" ON "public"."match_assignments" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."service_requests" "sr"
  WHERE (("sr"."id" = "match_assignments"."service_request_id") AND ("sr"."customer_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "match_assignments"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'moderator'::"public"."app_role"])))))));



ALTER TABLE "public"."match_pools" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "match_pools_customer_select" ON "public"."match_pools" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."service_requests" "sr"
  WHERE (("sr"."id" = "match_pools"."service_request_id") AND ("sr"."customer_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'moderator'::"public"."app_role"])))))));



ALTER TABLE "public"."matching_experiments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "matching_experiments_admin" ON "public"."matching_experiments" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."matching_explanations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "matching_explanations_select" ON "public"."matching_explanations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "matching_fairness_admin" ON "public"."matching_fairness_state" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."matching_fairness_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matching_feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "matching_feedback_admin" ON "public"."matching_feedback" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."matching_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "matching_history_admin" ON "public"."matching_history" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."matching_scores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "matching_scores_admin" ON "public"."matching_scores" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."matching_weights" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "matching_weights_admin" ON "public"."matching_weights" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "media_jobs_select" ON "public"."media_processing_jobs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."media_objects" "m"
  WHERE (("m"."id" = "media_processing_jobs"."media_object_id") AND (("m"."owner_user_id" = "auth"."uid"()) OR "public"."has_role"('admin'::"public"."app_role"))))));



ALTER TABLE "public"."media_objects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "media_objects_owner_insert" ON "public"."media_objects" FOR INSERT TO "authenticated" WITH CHECK (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "media_objects_owner_select" ON "public"."media_objects" FOR SELECT TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."has_role"('admin'::"public"."app_role") OR (("conversation_id" IS NOT NULL) AND "public"."is_conversation_participant"("conversation_id", "auth"."uid"())) OR (("project_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."service_projects" "sp"
  WHERE (("sp"."id" = "media_objects"."project_id") AND ("sp"."customer_id" = "auth"."uid"())))))));



CREATE POLICY "media_objects_owner_update" ON "public"."media_objects" FOR UPDATE TO "authenticated" USING ((("owner_user_id" = "auth"."uid"()) OR "public"."has_role"('admin'::"public"."app_role"))) WITH CHECK ((("owner_user_id" = "auth"."uid"()) OR "public"."has_role"('admin'::"public"."app_role")));



ALTER TABLE "public"."media_processing_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "message_attachments_insert" ON "public"."message_attachments" FOR INSERT TO "authenticated" WITH CHECK ((("uploader_id" = "auth"."uid"()) AND "public"."is_conversation_participant"("conversation_id", "auth"."uid"())));



CREATE POLICY "message_attachments_participant_update" ON "public"."message_attachments" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "message_attachments"."conversation_id") AND (("c"."customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."providers" "p"
          WHERE (("p"."id" = "c"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))) OR ("c"."admin_user_id" = "auth"."uid"())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "message_attachments"."conversation_id") AND (("c"."customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."providers" "p"
          WHERE (("p"."id" = "c"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))) OR ("c"."admin_user_id" = "auth"."uid"()))))));



CREATE POLICY "message_attachments_select" ON "public"."message_attachments" FOR SELECT TO "authenticated" USING ((("deleted_at" IS NULL) AND "public"."is_conversation_participant"("conversation_id", "auth"."uid"())));



ALTER TABLE "public"."message_read_receipts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "message_read_receipts_select" ON "public"."message_read_receipts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."messages" "m"
  WHERE (("m"."id" = "message_read_receipts"."message_id") AND "public"."is_conversation_participant"("m"."conversation_id", "auth"."uid"())))));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_participant_insert" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND "public"."is_conversation_participant"("conversation_id", "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."conversations" "c"
     LEFT JOIN "public"."service_requests" "sr" ON (("sr"."id" = "c"."service_request_id")))
  WHERE (("c"."id" = "messages"."conversation_id") AND ("c"."deleted_at" IS NULL) AND (("c"."service_request_id" IS NULL) OR (COALESCE("c"."chat_scope", 'request'::"text") = ANY (ARRAY['project'::"text", 'package'::"text", 'emergency'::"text", 'admin'::"text", 'support'::"text"])) OR ("sr"."status" = ANY (ARRAY['accepted'::"public"."service_request_status", 'quoted'::"public"."service_request_status", 'quote_accepted'::"public"."service_request_status", 'quote_declined'::"public"."service_request_status", 'in_progress'::"public"."service_request_status", 'completed_by_business'::"public"."service_request_status", 'completed'::"public"."service_request_status"]))))))));



CREATE POLICY "messages_participant_select" ON "public"."messages" FOR SELECT TO "authenticated" USING ((("deleted_at" IS NULL) AND "public"."is_conversation_participant"("conversation_id", "auth"."uid"()) AND ("public"."conversation_allows_message_insert"("conversation_id") OR (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND ("c"."thread_kind" = 'legacy'::"text") AND ("c"."deleted_at" IS NULL)))))));



CREATE POLICY "messages_sender_update" ON "public"."messages" FOR UPDATE TO "authenticated" USING ((("sender_id" = "auth"."uid"()) OR "public"."is_conversation_participant"("conversation_id", "auth"."uid"()))) WITH CHECK ("public"."is_conversation_participant"("conversation_id", "auth"."uid"()));



ALTER TABLE "public"."modules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "modules_public_read" ON "public"."modules" FOR SELECT USING (true);



CREATE POLICY "monetization_audit_admin" ON "public"."monetization_audit_logs" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."monetization_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."monetization_billing_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "monetization_settings_admin" ON "public"."monetization_billing_settings" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "monetization_settings_read" ON "public"."monetization_billing_settings" FOR SELECT TO "authenticated" USING (("is_active" = true));



ALTER TABLE "public"."notification_delivery_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_delivery_own_select" ON "public"."notification_delivery_attempts" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."notification_digests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_digests_own" ON "public"."notification_digests" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_preferences_own" ON "public"."notification_preferences" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "notification_push_own" ON "public"."notification_push_subscriptions" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."notification_push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."offer_clarifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "offer_clarifications_insert" ON "public"."offer_clarifications" FOR INSERT TO "authenticated" WITH CHECK ((("author_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM (("public"."marketplace_offers" "o"
     JOIN "public"."service_requests" "sr" ON (("sr"."id" = "o"."service_request_id")))
     LEFT JOIN "public"."providers" "p" ON (("p"."id" = "o"."provider_id")))
  WHERE (("o"."id" = "offer_clarifications"."offer_id") AND ("o"."service_request_id" = "offer_clarifications"."service_request_id") AND ((("offer_clarifications"."author_role" = 'customer'::"text") AND ("sr"."customer_id" = "auth"."uid"())) OR (("offer_clarifications"."author_role" = 'provider'::"text") AND ("p"."owner_id" = "auth"."uid"()))))))));



CREATE POLICY "offer_clarifications_select" ON "public"."offer_clarifications" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."marketplace_offers" "o"
     JOIN "public"."service_requests" "sr" ON (("sr"."id" = "o"."service_request_id")))
     LEFT JOIN "public"."providers" "p" ON (("p"."id" = "o"."provider_id")))
  WHERE (("o"."id" = "offer_clarifications"."offer_id") AND (("sr"."customer_id" = "auth"."uid"()) OR ("p"."owner_id" = "auth"."uid"()))))));



ALTER TABLE "public"."offer_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "offer_templates_owner_all" ON "public"."offer_templates" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "offer_templates"."provider_id") AND ("p"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "offer_templates"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))));



CREATE POLICY "opp_history_select" ON "public"."provider_opportunity_history" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."payment_disputes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_disputes_own" ON "public"."payment_disputes" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "payment_disputes"."provider_id") AND ("p"."owner_id" = "auth"."uid"()))))));



ALTER TABLE "public"."payment_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_events_select_admin" ON "public"."payment_events" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR "public"."has_role"('moderator'::"public"."app_role")));



CREATE POLICY "payment_snapshots_admin" ON "public"."payment_status_snapshots" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."payment_status_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_webhook_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_webhook_events_select_admin" ON "public"."payment_webhook_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'moderator'::"public"."app_role"]))))));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_select_own" ON "public"."payments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "payments"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL)))));



ALTER TABLE "public"."pdf_generation_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pdf_logs_admin" ON "public"."pdf_generation_logs" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."platform_alerts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_alerts_admin" ON "public"."platform_alerts" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."platform_anomalies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_anomalies_admin" ON "public"."platform_anomalies" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "platform_health_admin" ON "public"."platform_health_metrics" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."platform_health_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_ops_audit" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_ops_audit_insert" ON "public"."platform_ops_audit" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "platform_ops_audit_select" ON "public"."platform_ops_audit" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."platform_ops_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_ops_tasks_admin" ON "public"."platform_ops_tasks" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."platform_trends" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_trends_admin" ON "public"."platform_trends" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."pricing_experiments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pricing_experiments_admin" ON "public"."pricing_experiments" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."pricing_explanations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pricing_explanations_select" ON "public"."pricing_explanations" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."pricing_feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pricing_feedback_rw" ON "public"."pricing_feedback" TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"()))) OR ("customer_id" = "auth"."uid"()))) WITH CHECK (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"()))) OR ("customer_id" = "auth"."uid"())));



ALTER TABLE "public"."pricing_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pricing_history_admin" ON "public"."pricing_history" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"())))));



CREATE POLICY "pricing_market_admin" ON "public"."pricing_market_data" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."pricing_market_data" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pricing_market_select" ON "public"."pricing_market_data" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."pricing_weights" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pricing_weights_admin" ON "public"."pricing_weights" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT USING ((("auth"."uid"() = "user_id") AND ("deleted_at" IS NULL)));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING ((("auth"."uid"() = "user_id") AND ("deleted_at" IS NULL)));



ALTER TABLE "public"."project_activity_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_activity_member_insert" ON "public"."project_activity_events" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_project_member"("project_id", "auth"."uid"()));



CREATE POLICY "project_activity_member_select" ON "public"."project_activity_events" FOR SELECT TO "authenticated" USING ("public"."is_project_member"("project_id", "auth"."uid"()));



ALTER TABLE "public"."project_approvals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_approvals_customer_decide" ON "public"."project_approvals" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."service_projects" "sp"
  WHERE (("sp"."id" = "project_approvals"."project_id") AND ("sp"."customer_id" = "auth"."uid"())))) OR "public"."has_role"('admin'::"public"."app_role"))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."service_projects" "sp"
  WHERE (("sp"."id" = "project_approvals"."project_id") AND ("sp"."customer_id" = "auth"."uid"())))) OR "public"."has_role"('admin'::"public"."app_role")));



COMMENT ON POLICY "project_approvals_customer_decide" ON "public"."project_approvals" IS 'Sprint 5.5 — only project customer (or admin) may approve/reject.';



CREATE POLICY "project_approvals_member_insert" ON "public"."project_approvals" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_project_member"("project_id", "auth"."uid"()));



CREATE POLICY "project_approvals_member_select" ON "public"."project_approvals" FOR SELECT TO "authenticated" USING ("public"."is_project_member"("project_id", "auth"."uid"()));



ALTER TABLE "public"."project_checklist_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_checklist_items_member_all" ON "public"."project_checklist_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."project_checklists" "c"
  WHERE (("c"."id" = "project_checklist_items"."checklist_id") AND "public"."is_project_member"("c"."project_id", "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."project_checklists" "c"
  WHERE (("c"."id" = "project_checklist_items"."checklist_id") AND "public"."is_project_member"("c"."project_id", "auth"."uid"())))));



ALTER TABLE "public"."project_checklist_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_checklist_templates_read" ON "public"."project_checklist_templates" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."project_checklists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_checklists_member_all" ON "public"."project_checklists" TO "authenticated" USING ("public"."is_project_member"("project_id", "auth"."uid"())) WITH CHECK ("public"."is_project_member"("project_id", "auth"."uid"()));



CREATE POLICY "project_doc_versions_member_insert" ON "public"."project_document_versions" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_project_member"("project_id", "auth"."uid"()));



CREATE POLICY "project_doc_versions_member_select" ON "public"."project_document_versions" FOR SELECT TO "authenticated" USING ("public"."is_project_member"("project_id", "auth"."uid"()));



ALTER TABLE "public"."project_document_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_documents_admin" ON "public"."project_documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



CREATE POLICY "project_documents_customer" ON "public"."project_documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."service_projects" "p"
  WHERE (("p"."id" = "project_documents"."project_id") AND ("p"."customer_id" = "auth"."uid"())))));



CREATE POLICY "project_documents_customer_insert" ON "public"."project_documents" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."service_projects" "p"
  WHERE (("p"."id" = "project_documents"."project_id") AND ("p"."customer_id" = "auth"."uid"())))));



CREATE POLICY "project_documents_customer_update" ON "public"."project_documents" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."service_projects" "p"
  WHERE (("p"."id" = "project_documents"."project_id") AND ("p"."customer_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."service_projects" "p"
  WHERE (("p"."id" = "project_documents"."project_id") AND ("p"."customer_id" = "auth"."uid"())))));



ALTER TABLE "public"."project_packages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_packages_admin" ON "public"."project_packages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



CREATE POLICY "project_packages_customer" ON "public"."project_packages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."service_projects" "p"
  WHERE (("p"."id" = "project_packages"."project_id") AND ("p"."customer_id" = "auth"."uid"())))));



ALTER TABLE "public"."project_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_tasks_member_all" ON "public"."project_tasks" TO "authenticated" USING ("public"."is_project_member"("project_id", "auth"."uid"())) WITH CHECK ("public"."is_project_member"("project_id", "auth"."uid"()));



CREATE POLICY "project_timeline_admin" ON "public"."project_timeline_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



CREATE POLICY "project_timeline_customer" ON "public"."project_timeline_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."service_projects" "p"
  WHERE (("p"."id" = "project_timeline_events"."project_id") AND ("p"."customer_id" = "auth"."uid"())))));



ALTER TABLE "public"."project_timeline_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_availability_breaks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_availability_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_blocked_times" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_capacity" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "provider_capacity_owner" ON "public"."provider_capacity" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_capacity"."provider_id") AND ("p"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "provider_capacity_owner_write" ON "public"."provider_capacity" TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_capacity"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))))) WITH CHECK (("public"."has_role"('admin'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_capacity"."provider_id") AND ("p"."owner_id" = "auth"."uid"()))))));



ALTER TABLE "public"."provider_engagement_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "provider_engagement_insert_all" ON "public"."provider_engagement_events" FOR INSERT WITH CHECK (true);



CREATE POLICY "provider_engagement_select_owner_or_admin" ON "public"."provider_engagement_events" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_engagement_events"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL)))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL))))));



CREATE POLICY "provider_monetization_own" ON "public"."provider_monetization_plans" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_monetization_plans"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))) OR "public"."has_role"('admin'::"public"."app_role")));



ALTER TABLE "public"."provider_monetization_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_monthly_unlock_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_opportunities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_opportunity_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "provider_opps_rw" ON "public"."provider_opportunities" TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"()))))) WITH CHECK (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."provider_performance_scores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "provider_performance_select_admin" ON "public"."provider_performance_scores" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



CREATE POLICY "provider_performance_select_owner" ON "public"."provider_performance_scores" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_performance_scores"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL)))));



ALTER TABLE "public"."provider_reputation_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_reputation_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_reputation_explanations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_reputation_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "provider_reputation_read" ON "public"."provider_reputation_cache" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."provider_reputation_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_reputation_signals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_reputation_weights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_request_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "provider_request_settings_owner" ON "public"."provider_request_settings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_request_settings"."provider_id") AND ("p"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_request_settings"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))));



CREATE POLICY "provider_request_settings_public_select" ON "public"."provider_request_settings" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."provider_routes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "provider_routes_select" ON "public"."provider_routes" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."provider_schedule_gaps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provider_services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "provider_services_owner_all" ON "public"."provider_services" USING ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_services"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_services"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL)))));



CREATE POLICY "provider_services_public_read" ON "public"."provider_services" FOR SELECT USING ((("is_active" = true) AND ("deleted_at" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_services"."provider_id") AND ("p"."status" = 'active'::"public"."provider_status") AND ("p"."deleted_at" IS NULL))))));



CREATE POLICY "provider_unlock_usage_own" ON "public"."provider_monthly_unlock_usage" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_monthly_unlock_usage"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))) OR "public"."has_role"('admin'::"public"."app_role")));



ALTER TABLE "public"."provider_verification_checks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "provider_verification_checks_admin_write" ON "public"."provider_verification_checks" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "provider_verification_checks_own" ON "public"."provider_verification_checks" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_verification_checks"."provider_id") AND ("p"."owner_id" = "auth"."uid"()))))));



ALTER TABLE "public"."provider_verifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "provider_verifications_insert_own" ON "public"."provider_verifications" FOR INSERT WITH CHECK ((("status" = 'pending'::"public"."provider_verification_status") AND (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_verifications"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL))))));



CREATE POLICY "provider_verifications_select_admin" ON "public"."provider_verifications" FOR SELECT USING (("public"."has_role"('admin'::"public"."app_role") OR "public"."has_role"('moderator'::"public"."app_role")));



CREATE POLICY "provider_verifications_select_own" ON "public"."provider_verifications" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_verifications"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL)))));



CREATE POLICY "provider_verifications_update_admin" ON "public"."provider_verifications" FOR UPDATE USING (("public"."has_role"('admin'::"public"."app_role") OR "public"."has_role"('moderator'::"public"."app_role"))) WITH CHECK (("public"."has_role"('admin'::"public"."app_role") OR "public"."has_role"('moderator'::"public"."app_role")));



CREATE POLICY "provider_verifications_update_own" ON "public"."provider_verifications" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_verifications"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL)))) AND (("status" = 'rejected'::"public"."provider_verification_status") OR (("status" = 'pending'::"public"."provider_verification_status") AND ("reviewed_at" IS NULL))))) WITH CHECK ((("status" = 'pending'::"public"."provider_verification_status") AND (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_verifications"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL))))));



ALTER TABLE "public"."provider_working_hours" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "provider_working_hours_owner_all" ON "public"."provider_working_hours" USING ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_working_hours"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_working_hours"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL)))));



CREATE POLICY "provider_working_hours_public_read" ON "public"."provider_working_hours" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_working_hours"."provider_id") AND ("p"."status" = 'active'::"public"."provider_status") AND ("p"."deleted_at" IS NULL)))));



ALTER TABLE "public"."providers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "providers_insert_own" ON "public"."providers" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "providers_select_own" ON "public"."providers" FOR SELECT USING ((("auth"."uid"() = "owner_id") AND ("deleted_at" IS NULL)));



CREATE POLICY "providers_select_public_active" ON "public"."providers" FOR SELECT USING ((("status" = 'active'::"public"."provider_status") AND ("deleted_at" IS NULL)));



CREATE POLICY "providers_update_own" ON "public"."providers" FOR UPDATE USING ((("auth"."uid"() = "owner_id") AND ("deleted_at" IS NULL)));



CREATE POLICY "quality_ai_select" ON "public"."quality_case_ai_analysis" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."quality_cases" "c"
  WHERE (("c"."id" = "quality_case_ai_analysis"."case_id") AND (EXISTS ( SELECT 1
           FROM "public"."providers" "p"
          WHERE (("p"."id" = "c"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))))))));



CREATE POLICY "quality_assignments_admin" ON "public"."quality_case_assignments" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."quality_case_ai_analysis" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quality_case_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quality_case_evidence" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quality_case_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quality_case_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quality_case_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quality_cases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quality_cases_insert" ON "public"."quality_cases" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_role"('admin'::"public"."app_role") OR ("opened_by" = "auth"."uid"())));



CREATE POLICY "quality_cases_select" ON "public"."quality_cases" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR ("customer_id" = "auth"."uid"()) OR ("opened_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "quality_cases"."provider_id") AND ("p"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "quality_evidence_select" ON "public"."quality_case_evidence" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."quality_cases" "c"
  WHERE (("c"."id" = "quality_case_evidence"."case_id") AND (("c"."customer_id" = "auth"."uid"()) OR ("c"."opened_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."providers" "p"
          WHERE (("p"."id" = "c"."provider_id") AND ("p"."owner_id" = "auth"."uid"()))))))))));



CREATE POLICY "quality_history_select" ON "public"."quality_case_history" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."quality_cases" "c"
  WHERE (("c"."id" = "quality_case_history"."case_id") AND (("c"."customer_id" = "auth"."uid"()) OR ("c"."opened_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."providers" "p"
          WHERE (("p"."id" = "c"."provider_id") AND ("p"."owner_id" = "auth"."uid"()))))))))));



CREATE POLICY "quality_messages_insert" ON "public"."quality_case_messages" FOR INSERT TO "authenticated" WITH CHECK ((("author_id" = "auth"."uid"()) OR "public"."has_role"('admin'::"public"."app_role")));



CREATE POLICY "quality_messages_select" ON "public"."quality_case_messages" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR (("visibility" = 'shared'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."quality_cases" "c"
  WHERE (("c"."id" = "quality_case_messages"."case_id") AND (("c"."customer_id" = "auth"."uid"()) OR ("c"."opened_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."providers" "p"
          WHERE (("p"."id" = "c"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))))))))));



CREATE POLICY "quality_metrics_select" ON "public"."quality_case_metrics" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "quality_case_metrics"."provider_id") AND ("p"."owner_id" = "auth"."uid"()))))));



ALTER TABLE "public"."quote_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quote_items_participant_select" ON "public"."quote_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."quotes" "q"
     JOIN "public"."service_requests" "sr" ON (("sr"."id" = "q"."service_request_id")))
  WHERE (("q"."id" = "quote_items"."quote_id") AND (("sr"."customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."providers" "p"
          WHERE (("p"."id" = "sr"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))))))));



CREATE POLICY "quote_items_provider_insert" ON "public"."quote_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."quotes" "q"
     JOIN "public"."providers" "p" ON (("p"."id" = "q"."provider_id")))
  WHERE (("q"."id" = "quote_items"."quote_id") AND ("p"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."quotes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quotes_participant_select" ON "public"."quotes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."service_requests" "sr"
  WHERE (("sr"."id" = "quotes"."service_request_id") AND (("sr"."customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."providers" "p"
          WHERE (("p"."id" = "sr"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))))))));



CREATE POLICY "quotes_participant_update" ON "public"."quotes" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."service_requests" "sr"
  WHERE (("sr"."id" = "quotes"."service_request_id") AND (("sr"."customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."providers" "p"
          WHERE (("p"."id" = "sr"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))))))));



CREATE POLICY "quotes_provider_insert" ON "public"."quotes" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."providers" "p"
     JOIN "public"."service_requests" "sr" ON (("sr"."id" = "quotes"."service_request_id")))
  WHERE (("p"."id" = "quotes"."provider_id") AND ("p"."id" = "sr"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL)))));



ALTER TABLE "public"."receipt_metadata" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "receipt_metadata_own" ON "public"."receipt_metadata" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM ("public"."financial_documents" "d"
     JOIN "public"."providers" "p" ON (("p"."id" = "d"."provider_id")))
  WHERE (("d"."id" = "receipt_metadata"."document_id") AND ("p"."owner_id" = "auth"."uid"()))))));



ALTER TABLE "public"."recurring_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recurring_plans_admin" ON "public"."recurring_plans" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



CREATE POLICY "recurring_plans_customer" ON "public"."recurring_plans" FOR SELECT USING (("customer_id" = "auth"."uid"()));



ALTER TABLE "public"."recurring_recommendations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recurring_recommendations_customer" ON "public"."recurring_recommendations" FOR SELECT USING (("customer_id" = "auth"."uid"()));



ALTER TABLE "public"."recurring_reminder_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recurring_visits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recurring_visits_customer" ON "public"."recurring_visits" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."recurring_plans" "p"
  WHERE (("p"."id" = "recurring_visits"."plan_id") AND ("p"."customer_id" = "auth"."uid"())))));



ALTER TABLE "public"."refund_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "refund_history_own" ON "public"."refund_history" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM ("public"."refund_requests" "r"
     JOIN "public"."providers" "p" ON (("p"."id" = "r"."provider_id")))
  WHERE (("r"."id" = "refund_history"."refund_request_id") AND ("p"."owner_id" = "auth"."uid"()))))));



ALTER TABLE "public"."refund_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "refund_requests_own" ON "public"."refund_requests" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "refund_requests"."provider_id") AND ("p"."owner_id" = "auth"."uid"()))))));



ALTER TABLE "public"."region_health" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "region_health_admin" ON "public"."region_health" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "reputation_events_admin" ON "public"."provider_reputation_events" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "reputation_explanations_public" ON "public"."provider_reputation_explanations" FOR SELECT TO "authenticated" USING (((("audience" = 'public'::"text") AND ("polarity" = 'positive'::"text")) OR "public"."has_role"('admin'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_reputation_explanations"."provider_id") AND ("p"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "reputation_history_owner_or_admin" ON "public"."provider_reputation_history" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_reputation_history"."provider_id") AND ("p"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "reputation_scores_owner_or_admin" ON "public"."provider_reputation_scores" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_reputation_scores"."provider_id") AND ("p"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "reputation_signals_owner_or_admin" ON "public"."provider_reputation_signals" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "provider_reputation_signals"."provider_id") AND ("p"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "reputation_weights_read" ON "public"."provider_reputation_weights" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."review_ai_analysis" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "review_ai_public_read" ON "public"."review_ai_analysis" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."service_reviews" "r"
  WHERE (("r"."id" = "review_ai_analysis"."review_id") AND ("r"."status" = 'approved'::"public"."review_status") AND ("r"."deleted_at" IS NULL)))) OR "public"."has_role"('admin'::"public"."app_role")));



ALTER TABLE "public"."review_flags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "review_flags_admin" ON "public"."review_flags" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "review_helpful_delete_own" ON "public"."service_review_helpful_votes" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "review_helpful_insert_own" ON "public"."service_review_helpful_votes" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."service_reviews" "r"
  WHERE (("r"."id" = "service_review_helpful_votes"."review_id") AND ("r"."deleted_at" IS NULL) AND ("r"."status" = 'approved'::"public"."review_status") AND ("r"."customer_id" <> "auth"."uid"()))))));



CREATE POLICY "review_helpful_select_own" ON "public"."service_review_helpful_votes" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."review_media" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "review_media_public_read" ON "public"."review_media" FOR SELECT TO "authenticated" USING (((("moderation_status" = 'approved'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."service_reviews" "r"
  WHERE (("r"."id" = "review_media"."review_id") AND ("r"."status" = 'approved'::"public"."review_status") AND ("r"."deleted_at" IS NULL))))) OR "public"."has_role"('admin'::"public"."app_role")));



ALTER TABLE "public"."review_moderation" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "review_moderation_admin" ON "public"."review_moderation" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."review_ratings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "review_ratings_public_read" ON "public"."review_ratings" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."service_reviews" "r"
  WHERE (("r"."id" = "review_ratings"."review_id") AND ("r"."status" = 'approved'::"public"."review_status") AND ("r"."deleted_at" IS NULL)))) OR "public"."has_role"('admin'::"public"."app_role")));



ALTER TABLE "public"."review_responses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "review_responses_public_read" ON "public"."review_responses" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."service_reviews" "r"
  WHERE (("r"."id" = "review_responses"."review_id") AND ("r"."status" = 'approved'::"public"."review_status") AND ("r"."deleted_at" IS NULL)))) OR "public"."has_role"('admin'::"public"."app_role")));



ALTER TABLE "public"."review_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "review_settings_read" ON "public"."review_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "risk_history_admin_insert" ON "public"."risk_score_history" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "risk_history_admin_select" ON "public"."risk_score_history" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."risk_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "risk_rules_admin" ON "public"."risk_rules" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."risk_score_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."risk_scores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "risk_scores_admin" ON "public"."risk_scores" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "route_cache_admin" ON "public"."route_optimization_cache" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."route_optimization_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedule_experiments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schedule_experiments_admin" ON "public"."schedule_experiments" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



CREATE POLICY "schedule_expl_select" ON "public"."schedule_explanations" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."schedule_explanations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schedule_gaps_select" ON "public"."provider_schedule_gaps" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."schedule_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schedule_history_select" ON "public"."schedule_history" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."schedule_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schedule_profiles_admin" ON "public"."schedule_profiles" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."schedule_recommendations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schedule_recs_select" ON "public"."schedule_recommendations" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"())))));



CREATE POLICY "schedule_recs_update" ON "public"."schedule_recommendations" FOR UPDATE TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR ("provider_id" IN ( SELECT "providers"."id"
   FROM "public"."providers"
  WHERE ("providers"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."schedule_signal_weights" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schedule_weights_admin" ON "public"."schedule_signal_weights" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."search_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "search_logs_insert_all" ON "public"."search_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "search_logs_select_admin" ON "public"."search_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



CREATE POLICY "sequences_admin" ON "public"."document_number_sequences" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role"));



ALTER TABLE "public"."service_projects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_projects_admin" ON "public"."service_projects" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role") AND ("user_roles"."revoked_at" IS NULL)))));



CREATE POLICY "service_projects_customer" ON "public"."service_projects" FOR SELECT USING (("customer_id" = "auth"."uid"()));



ALTER TABLE "public"."service_request_images" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_request_images_customer_insert" ON "public"."service_request_images" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."service_requests" "sr"
  WHERE (("sr"."id" = "service_request_images"."request_id") AND ("sr"."customer_id" = "auth"."uid"())))));



CREATE POLICY "service_request_images_participant_select" ON "public"."service_request_images" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."service_requests" "sr"
  WHERE (("sr"."id" = "service_request_images"."request_id") AND (("sr"."customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."providers" "p"
          WHERE (("p"."id" = "sr"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))))))));



ALTER TABLE "public"."service_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_requests_admin_select" ON "public"."service_requests" FOR SELECT TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR "public"."has_role"('moderator'::"public"."app_role")));



CREATE POLICY "service_requests_customer_insert" ON "public"."service_requests" FOR INSERT TO "authenticated" WITH CHECK (("customer_id" = "auth"."uid"()));



CREATE POLICY "service_requests_customer_select" ON "public"."service_requests" FOR SELECT TO "authenticated" USING (("customer_id" = "auth"."uid"()));



CREATE POLICY "service_requests_customer_update" ON "public"."service_requests" FOR UPDATE TO "authenticated" USING (("customer_id" = "auth"."uid"())) WITH CHECK (("customer_id" = "auth"."uid"()));



CREATE POLICY "service_requests_provider_select" ON "public"."service_requests" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "service_requests"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL)))) OR "public"."provider_owns_match_assignment_for_request"("id") OR "public"."provider_has_marketplace_access_to_request"("id")));



COMMENT ON POLICY "service_requests_provider_select" ON "public"."service_requests" IS 'Legacy RFQ provider_id OR match assignment OR Marketplace v2 grant/selection/session.';



CREATE POLICY "service_requests_provider_update" ON "public"."service_requests" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "service_requests"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "service_requests"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL)))));



ALTER TABLE "public"."service_review_helpful_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_review_images" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_review_images_insert" ON "public"."service_review_images" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."service_reviews" "r"
  WHERE (("r"."id" = "service_review_images"."review_id") AND ("r"."customer_id" = "auth"."uid"())))));



CREATE POLICY "service_review_images_select" ON "public"."service_review_images" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."service_reviews" "r"
  WHERE (("r"."id" = "service_review_images"."review_id") AND (("r"."customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."providers" "p"
          WHERE (("p"."id" = "r"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))) OR "public"."has_role"('admin'::"public"."app_role"))))));



CREATE POLICY "service_review_images_select_public_approved" ON "public"."service_review_images" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."service_reviews" "r"
  WHERE (("r"."id" = "service_review_images"."review_id") AND ("r"."deleted_at" IS NULL) AND ("r"."status" = 'approved'::"public"."review_status")))));



ALTER TABLE "public"."service_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_reviews_admin_moderate" ON "public"."service_reviews" FOR UPDATE TO "authenticated" USING (("public"."has_role"('admin'::"public"."app_role") OR "public"."has_role"('moderator'::"public"."app_role"))) WITH CHECK (("public"."has_role"('admin'::"public"."app_role") OR "public"."has_role"('moderator'::"public"."app_role")));



CREATE POLICY "service_reviews_customer_insert" ON "public"."service_reviews" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."service_requests" "sr"
  WHERE (("sr"."id" = "service_reviews"."service_request_id") AND ("sr"."customer_id" = "auth"."uid"()) AND ("sr"."status" = 'completed'::"public"."service_request_status") AND (("sr"."provider_id" = "service_reviews"."provider_id") OR (("sr"."provider_id" IS NULL) AND (COALESCE(("sr"."lifecycle_version")::integer, 1) >= 2) AND (EXISTS ( SELECT 1
           FROM "public"."contact_release_grants" "g"
          WHERE (("g"."service_request_id" = "sr"."id") AND ("g"."provider_id" = "service_reviews"."provider_id")))))))))));



CREATE POLICY "service_reviews_provider_reply" ON "public"."service_reviews" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "service_reviews"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "service_reviews"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL)))));



CREATE POLICY "service_reviews_select" ON "public"."service_reviews" FOR SELECT TO "authenticated" USING ((("customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "service_reviews"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))) OR "public"."has_role"('admin'::"public"."app_role") OR "public"."has_role"('moderator'::"public"."app_role")));



CREATE POLICY "service_reviews_select_public_approved" ON "public"."service_reviews" FOR SELECT TO "authenticated", "anon" USING ((("deleted_at" IS NULL) AND ("status" = 'approved'::"public"."review_status")));



ALTER TABLE "public"."smart_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "smart_notifications_own_select" ON "public"."smart_notifications" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "smart_notifications_own_update" ON "public"."smart_notifications" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."subscription_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscription_plans_public_read" ON "public"."subscription_plans" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscriptions_select_own" ON "public"."subscriptions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "subscriptions"."provider_id") AND ("p"."owner_id" = "auth"."uid"()) AND ("p"."deleted_at" IS NULL)))));



ALTER TABLE "public"."unlock_reliability_signals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "unlock_reliability_signals_select" ON "public"."unlock_reliability_signals" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "unlock_reliability_signals"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'moderator'::"public"."app_role"])))))));



ALTER TABLE "public"."unlock_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "unlock_sessions_select" ON "public"."unlock_sessions" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."service_requests" "sr"
  WHERE (("sr"."id" = "unlock_sessions"."service_request_id") AND ("sr"."customer_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "unlock_sessions"."provider_id") AND ("p"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'moderator'::"public"."app_role"])))))));



ALTER TABLE "public"."user_presence" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_presence_select" ON "public"."user_presence" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."conversation_participants" "cp1"
     JOIN "public"."conversation_participants" "cp2" ON (("cp1"."conversation_id" = "cp2"."conversation_id")))
  WHERE (("cp1"."user_id" = "auth"."uid"()) AND ("cp2"."user_id" = "user_presence"."user_id") AND ("cp1"."deleted_at" IS NULL) AND ("cp2"."deleted_at" IS NULL))))));



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_roles_select_own" ON "public"."user_roles" FOR SELECT USING ((("auth"."uid"() = "user_id") AND ("revoked_at" IS NULL)));



ALTER TABLE "public"."user_storage_usage" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_storage_usage_self" ON "public"."user_storage_usage" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"('admin'::"public"."app_role")));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_insert_own" ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "users_select_own" ON "public"."users" FOR SELECT USING ((("auth"."uid"() = "id") AND ("deleted_at" IS NULL)));



CREATE POLICY "users_update_own" ON "public"."users" FOR UPDATE USING ((("auth"."uid"() = "id") AND ("deleted_at" IS NULL)));



ALTER TABLE "public"."verification_levels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "verification_levels_read" ON "public"."verification_levels" FOR SELECT TO "authenticated" USING (("is_active" = true));



ALTER TABLE "public"."verification_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "verification_types_read" ON "public"."verification_types" FOR SELECT TO "authenticated" USING (("is_active" = true));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."bookings";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."contact_release_grants";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."conversation_participants";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."conversation_typing";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."conversations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."marketplace_notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."marketplace_offers";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."marketplace_selections";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."match_assignments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."message_attachments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."message_read_receipts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."provider_availability_settings";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."provider_blocked_times";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."quotes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."service_requests";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."unlock_sessions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."user_presence";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."accept_service_request"("p_request_id" "uuid", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_service_request"("p_request_id" "uuid", "p_actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_service_request"("p_request_id" "uuid", "p_actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_service_request"("p_request_id" "uuid", "p_actor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."bookings_no_overlap"() TO "anon";
GRANT ALL ON FUNCTION "public"."bookings_no_overlap"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bookings_no_overlap"() TO "service_role";



GRANT ALL ON FUNCTION "public"."clear_conversation_typing"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."clear_conversation_typing"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."clear_conversation_typing"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."conversation_allows_message_insert"("p_conversation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."conversation_allows_message_insert"("p_conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."conversation_allows_message_insert"("p_conversation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_service_request_status_transition"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_service_request_status_transition"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_service_request_status_transition"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_chat_release_grant"("p_service_request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_chat_release_grant"("p_service_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_chat_release_grant"("p_service_request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("check_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("check_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("check_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_booking_participant"("p_booking_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_booking_participant"("p_booking_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_booking_participant"("p_booking_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_conversation_participant"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_conversation_participant"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_conversation_participant"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_project_member"("p_project_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_project_member"("p_project_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_project_member"("p_project_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_provider_owner"("p_provider_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_provider_owner"("p_provider_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_provider_owner"("p_provider_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_booking_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_booking_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_booking_status_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_all_conversations_read"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_all_conversations_read"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_all_conversations_read"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_all_conversations_read"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_conversation_read"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_conversation_read"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_conversation_read"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_messages_delivered"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_messages_delivered"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_messages_delivered"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."next_document_number"("p_prefix" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."next_document_number"("p_prefix" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."next_document_number"("p_prefix" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."next_investigation_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."next_investigation_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."next_investigation_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."next_quality_case_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."next_quality_case_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."next_quality_case_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_marketplace_user"("p_user_id" "uuid", "p_type" character varying, "p_title_key" character varying, "p_body_key" character varying, "p_body_params" "jsonb", "p_href" "text", "p_request_id" "uuid", "p_conversation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."notify_marketplace_user"("p_user_id" "uuid", "p_type" character varying, "p_title_key" character varying, "p_body_key" character varying, "p_body_params" "jsonb", "p_href" "text", "p_request_id" "uuid", "p_conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_marketplace_user"("p_user_id" "uuid", "p_type" character varying, "p_title_key" character varying, "p_body_key" character varying, "p_body_params" "jsonb", "p_href" "text", "p_request_id" "uuid", "p_conversation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."post_system_message"("p_conversation_id" "uuid", "p_actor_id" "uuid", "p_body" "text", "p_event_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."post_system_message"("p_conversation_id" "uuid", "p_actor_id" "uuid", "p_body" "text", "p_event_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."post_system_message"("p_conversation_id" "uuid", "p_actor_id" "uuid", "p_body" "text", "p_event_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_privileged_user_self_updates"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_privileged_user_self_updates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_privileged_user_self_updates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_provider_privileged_self_updates"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_provider_privileged_self_updates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_provider_privileged_self_updates"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."promote_bookings_awaiting_confirmation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."promote_bookings_awaiting_confirmation"() TO "anon";
GRANT ALL ON FUNCTION "public"."promote_bookings_awaiting_confirmation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."promote_bookings_awaiting_confirmation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."provider_has_marketplace_access_to_request"("p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."provider_has_marketplace_access_to_request"("p_request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."provider_has_marketplace_access_to_request"("p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."provider_has_marketplace_access_to_request"("p_request_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."provider_owns_match_assignment_for_request"("p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."provider_owns_match_assignment_for_request"("p_request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."provider_owns_match_assignment_for_request"("p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."provider_owns_match_assignment_for_request"("p_request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recompute_provider_trust_score"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recompute_provider_trust_score"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_provider_trust_score"("p_provider_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."recompute_user_storage_usage"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recompute_user_storage_usage"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recompute_user_storage_usage"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_user_storage_usage"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reject_service_request"("p_request_id" "uuid", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reject_service_request"("p_request_id" "uuid", "p_actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_service_request"("p_request_id" "uuid", "p_actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_service_request"("p_request_id" "uuid", "p_actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."restore_media_object"("p_media_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."restore_media_object"("p_media_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."restore_media_object"("p_media_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_media_object"("p_media_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_chat_messages"("p_user_id" "uuid", "p_query" "text", "p_conversation_id" "uuid", "p_sender_id" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_chat_messages"("p_user_id" "uuid", "p_query" "text", "p_conversation_id" "uuid", "p_sender_id" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_chat_messages"("p_user_id" "uuid", "p_query" "text", "p_conversation_id" "uuid", "p_sender_id" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_chat_messages"("p_user_id" "uuid", "p_query" "text", "p_conversation_id" "uuid", "p_sender_id" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_chat_voice_transcripts"("p_user_id" "uuid", "p_query" "text", "p_conversation_id" "uuid", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_chat_voice_transcripts"("p_user_id" "uuid", "p_query" "text", "p_conversation_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_chat_voice_transcripts"("p_user_id" "uuid", "p_query" "text", "p_conversation_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_chat_voice_transcripts"("p_user_id" "uuid", "p_query" "text", "p_conversation_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."service_request_transition_allowed"("p_old" "public"."service_request_status", "p_new" "public"."service_request_status") TO "anon";
GRANT ALL ON FUNCTION "public"."service_request_transition_allowed"("p_old" "public"."service_request_status", "p_new" "public"."service_request_status") TO "authenticated";
GRANT ALL ON FUNCTION "public"."service_request_transition_allowed"("p_old" "public"."service_request_status", "p_new" "public"."service_request_status") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."soft_delete_media_object"("p_media_id" "uuid", "p_user_id" "uuid", "p_restore_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."soft_delete_media_object"("p_media_id" "uuid", "p_user_id" "uuid", "p_restore_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_media_object"("p_media_id" "uuid", "p_user_id" "uuid", "p_restore_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_media_object"("p_media_id" "uuid", "p_user_id" "uuid", "p_restore_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_conversation_participants"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_conversation_participants"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_conversation_participants"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_review_helpful_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_review_helpful_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_review_helpful_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_booking_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_booking_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_booking_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_conversation_last_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_conversation_last_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_conversation_last_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_conversation_typing"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."touch_conversation_typing"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_conversation_typing"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_media_objects_storage"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_media_objects_storage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_media_objects_storage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_user_presence"("p_user_id" "uuid", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_user_presence"("p_user_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_user_presence"("p_user_id" "uuid", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT ALL ON TABLE "public"."admin_action_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_action_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_action_logs" TO "service_role";



GRANT ALL ON TABLE "public"."admin_broadcasts" TO "anon";
GRANT ALL ON TABLE "public"."admin_broadcasts" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_broadcasts" TO "service_role";



GRANT ALL ON TABLE "public"."ai_assistant_contexts" TO "anon";
GRANT ALL ON TABLE "public"."ai_assistant_contexts" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_assistant_contexts" TO "service_role";



GRANT ALL ON TABLE "public"."ai_automation_actions" TO "anon";
GRANT ALL ON TABLE "public"."ai_automation_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_automation_actions" TO "service_role";



GRANT ALL ON TABLE "public"."ai_automation_approvals" TO "anon";
GRANT ALL ON TABLE "public"."ai_automation_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_automation_approvals" TO "service_role";



GRANT ALL ON TABLE "public"."ai_automation_feedback" TO "anon";
GRANT ALL ON TABLE "public"."ai_automation_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_automation_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."ai_automation_policies" TO "anon";
GRANT ALL ON TABLE "public"."ai_automation_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_automation_policies" TO "service_role";



GRANT ALL ON TABLE "public"."ai_availability_forecasts" TO "anon";
GRANT ALL ON TABLE "public"."ai_availability_forecasts" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_availability_forecasts" TO "service_role";



GRANT ALL ON TABLE "public"."ai_chat_action_items" TO "anon";
GRANT ALL ON TABLE "public"."ai_chat_action_items" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_chat_action_items" TO "service_role";



GRANT ALL ON TABLE "public"."ai_chat_extractions" TO "anon";
GRANT ALL ON TABLE "public"."ai_chat_extractions" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_chat_extractions" TO "service_role";



GRANT ALL ON TABLE "public"."ai_chat_preferences" TO "anon";
GRANT ALL ON TABLE "public"."ai_chat_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_chat_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."ai_chat_sentiment" TO "anon";
GRANT ALL ON TABLE "public"."ai_chat_sentiment" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_chat_sentiment" TO "service_role";



GRANT ALL ON TABLE "public"."ai_chat_translations" TO "anon";
GRANT ALL ON TABLE "public"."ai_chat_translations" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_chat_translations" TO "service_role";



GRANT ALL ON TABLE "public"."ai_conversation_summaries" TO "anon";
GRANT ALL ON TABLE "public"."ai_conversation_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_conversation_summaries" TO "service_role";



GRANT ALL ON TABLE "public"."ai_demand_forecasts" TO "anon";
GRANT ALL ON TABLE "public"."ai_demand_forecasts" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_demand_forecasts" TO "service_role";



GRANT ALL ON TABLE "public"."ai_dispatch_predictions" TO "anon";
GRANT ALL ON TABLE "public"."ai_dispatch_predictions" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_dispatch_predictions" TO "service_role";



GRANT ALL ON TABLE "public"."ai_intent_decisions" TO "anon";
GRANT ALL ON TABLE "public"."ai_intent_decisions" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_intent_decisions" TO "service_role";



GRANT ALL ON TABLE "public"."ai_intent_memory" TO "anon";
GRANT ALL ON TABLE "public"."ai_intent_memory" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_intent_memory" TO "service_role";



GRANT ALL ON TABLE "public"."ai_job_analyses" TO "anon";
GRANT ALL ON TABLE "public"."ai_job_analyses" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_job_analyses" TO "service_role";



GRANT ALL ON TABLE "public"."ai_knowledge_phrases" TO "anon";
GRANT ALL ON TABLE "public"."ai_knowledge_phrases" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_knowledge_phrases" TO "service_role";



GRANT ALL ON TABLE "public"."ai_marketplace_balances" TO "anon";
GRANT ALL ON TABLE "public"."ai_marketplace_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_marketplace_balances" TO "service_role";



GRANT ALL ON TABLE "public"."ai_marketplace_path_stats" TO "anon";
GRANT ALL ON TABLE "public"."ai_marketplace_path_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_marketplace_path_stats" TO "service_role";



GRANT ALL ON TABLE "public"."ai_offer_comparisons" TO "anon";
GRANT ALL ON TABLE "public"."ai_offer_comparisons" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_offer_comparisons" TO "service_role";



GRANT ALL ON TABLE "public"."ai_prediction_outcomes" TO "anon";
GRANT ALL ON TABLE "public"."ai_prediction_outcomes" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_prediction_outcomes" TO "service_role";



GRANT ALL ON TABLE "public"."ai_predictive_notifications" TO "anon";
GRANT ALL ON TABLE "public"."ai_predictive_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_predictive_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."ai_proactive_suggestions" TO "anon";
GRANT ALL ON TABLE "public"."ai_proactive_suggestions" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_proactive_suggestions" TO "service_role";



GRANT ALL ON TABLE "public"."ai_provider_automation_settings" TO "anon";
GRANT ALL ON TABLE "public"."ai_provider_automation_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_provider_automation_settings" TO "service_role";



GRANT ALL ON TABLE "public"."ai_provider_reputation" TO "anon";
GRANT ALL ON TABLE "public"."ai_provider_reputation" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_provider_reputation" TO "service_role";



GRANT ALL ON TABLE "public"."ai_service_knowledge" TO "anon";
GRANT ALL ON TABLE "public"."ai_service_knowledge" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_service_knowledge" TO "service_role";



GRANT ALL ON TABLE "public"."ai_vision_analyses" TO "anon";
GRANT ALL ON TABLE "public"."ai_vision_analyses" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_vision_analyses" TO "service_role";



GRANT ALL ON TABLE "public"."ai_voice_transcripts" TO "anon";
GRANT ALL ON TABLE "public"."ai_voice_transcripts" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_voice_transcripts" TO "service_role";



GRANT ALL ON TABLE "public"."ai_wait_time_estimates" TO "anon";
GRANT ALL ON TABLE "public"."ai_wait_time_estimates" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_wait_time_estimates" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."booking_analytics_events" TO "anon";
GRANT ALL ON TABLE "public"."booking_analytics_events" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_analytics_events" TO "service_role";



GRANT ALL ON TABLE "public"."booking_attachments" TO "anon";
GRANT ALL ON TABLE "public"."booking_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."booking_issue_reports" TO "anon";
GRANT ALL ON TABLE "public"."booking_issue_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_issue_reports" TO "service_role";



GRANT ALL ON TABLE "public"."booking_notes" TO "anon";
GRANT ALL ON TABLE "public"."booking_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_notes" TO "service_role";



GRANT ALL ON TABLE "public"."booking_reminder_log" TO "anon";
GRANT ALL ON TABLE "public"."booking_reminder_log" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_reminder_log" TO "service_role";



GRANT ALL ON TABLE "public"."booking_slot_feedback" TO "anon";
GRANT ALL ON TABLE "public"."booking_slot_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_slot_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."booking_status_log" TO "anon";
GRANT ALL ON TABLE "public"."booking_status_log" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_status_log" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."business_assistant_experiments" TO "anon";
GRANT ALL ON TABLE "public"."business_assistant_experiments" TO "authenticated";
GRANT ALL ON TABLE "public"."business_assistant_experiments" TO "service_role";



GRANT ALL ON TABLE "public"."business_benchmarks" TO "anon";
GRANT ALL ON TABLE "public"."business_benchmarks" TO "authenticated";
GRANT ALL ON TABLE "public"."business_benchmarks" TO "service_role";



GRANT ALL ON TABLE "public"."business_briefings" TO "anon";
GRANT ALL ON TABLE "public"."business_briefings" TO "authenticated";
GRANT ALL ON TABLE "public"."business_briefings" TO "service_role";



GRANT ALL ON TABLE "public"."business_goal_progress" TO "anon";
GRANT ALL ON TABLE "public"."business_goal_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."business_goal_progress" TO "service_role";



GRANT ALL ON TABLE "public"."business_goals" TO "anon";
GRANT ALL ON TABLE "public"."business_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."business_goals" TO "service_role";



GRANT ALL ON TABLE "public"."business_health" TO "anon";
GRANT ALL ON TABLE "public"."business_health" TO "authenticated";
GRANT ALL ON TABLE "public"."business_health" TO "service_role";



GRANT ALL ON TABLE "public"."business_insights" TO "anon";
GRANT ALL ON TABLE "public"."business_insights" TO "authenticated";
GRANT ALL ON TABLE "public"."business_insights" TO "service_role";



GRANT ALL ON TABLE "public"."business_recommendations" TO "anon";
GRANT ALL ON TABLE "public"."business_recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."business_recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."business_subscription_payments" TO "anon";
GRANT ALL ON TABLE "public"."business_subscription_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."business_subscription_payments" TO "service_role";



GRANT ALL ON TABLE "public"."capacity_history" TO "anon";
GRANT ALL ON TABLE "public"."capacity_history" TO "authenticated";
GRANT ALL ON TABLE "public"."capacity_history" TO "service_role";



GRANT ALL ON TABLE "public"."capacity_predictions" TO "anon";
GRANT ALL ON TABLE "public"."capacity_predictions" TO "authenticated";
GRANT ALL ON TABLE "public"."capacity_predictions" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."category_health" TO "anon";
GRANT ALL ON TABLE "public"."category_health" TO "authenticated";
GRANT ALL ON TABLE "public"."category_health" TO "service_role";



GRANT ALL ON TABLE "public"."cell_policies" TO "anon";
GRANT ALL ON TABLE "public"."cell_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."cell_policies" TO "service_role";



GRANT ALL ON TABLE "public"."chat_analytics_events" TO "anon";
GRANT ALL ON TABLE "public"."chat_analytics_events" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_analytics_events" TO "service_role";



GRANT ALL ON TABLE "public"."chat_voice_transcript_translations" TO "anon";
GRANT ALL ON TABLE "public"."chat_voice_transcript_translations" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_voice_transcript_translations" TO "service_role";



GRANT ALL ON TABLE "public"."chat_voice_transcripts" TO "anon";
GRANT ALL ON TABLE "public"."chat_voice_transcripts" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_voice_transcripts" TO "service_role";



GRANT ALL ON TABLE "public"."cities" TO "anon";
GRANT ALL ON TABLE "public"."cities" TO "authenticated";
GRANT ALL ON TABLE "public"."cities" TO "service_role";



GRANT ALL ON TABLE "public"."company_billing_settings" TO "anon";
GRANT ALL ON TABLE "public"."company_billing_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."company_billing_settings" TO "service_role";



GRANT ALL ON TABLE "public"."contact_release_grants" TO "anon";
GRANT ALL ON TABLE "public"."contact_release_grants" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_release_grants" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_participants" TO "anon";
GRANT ALL ON TABLE "public"."conversation_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_participants" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_typing" TO "anon";
GRANT ALL ON TABLE "public"."conversation_typing" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_typing" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."credit_note_metadata" TO "anon";
GRANT ALL ON TABLE "public"."credit_note_metadata" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_note_metadata" TO "service_role";



GRANT ALL ON TABLE "public"."customer_preference_profiles" TO "anon";
GRANT ALL ON TABLE "public"."customer_preference_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_preference_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."customer_preferences" TO "anon";
GRANT ALL ON TABLE "public"."customer_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."dispute_evidence" TO "anon";
GRANT ALL ON TABLE "public"."dispute_evidence" TO "authenticated";
GRANT ALL ON TABLE "public"."dispute_evidence" TO "service_role";



GRANT ALL ON TABLE "public"."document_download_history" TO "anon";
GRANT ALL ON TABLE "public"."document_download_history" TO "authenticated";
GRANT ALL ON TABLE "public"."document_download_history" TO "service_role";



GRANT ALL ON TABLE "public"."document_number_sequences" TO "anon";
GRANT ALL ON TABLE "public"."document_number_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."document_number_sequences" TO "service_role";



GRANT ALL ON TABLE "public"."emergency_dispatch_responses" TO "anon";
GRANT ALL ON TABLE "public"."emergency_dispatch_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."emergency_dispatch_responses" TO "service_role";



GRANT ALL ON TABLE "public"."emergency_dispatches" TO "anon";
GRANT ALL ON TABLE "public"."emergency_dispatches" TO "authenticated";
GRANT ALL ON TABLE "public"."emergency_dispatches" TO "service_role";



GRANT ALL ON TABLE "public"."emergency_live_locations" TO "anon";
GRANT ALL ON TABLE "public"."emergency_live_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."emergency_live_locations" TO "service_role";



GRANT ALL ON TABLE "public"."emergency_timeline_events" TO "anon";
GRANT ALL ON TABLE "public"."emergency_timeline_events" TO "authenticated";
GRANT ALL ON TABLE "public"."emergency_timeline_events" TO "service_role";



GRANT ALL ON TABLE "public"."entity_relationships" TO "anon";
GRANT ALL ON TABLE "public"."entity_relationships" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_relationships" TO "service_role";



GRANT ALL ON TABLE "public"."finance_analytics_cache" TO "anon";
GRANT ALL ON TABLE "public"."finance_analytics_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_analytics_cache" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."finance_paid_payments_v" TO "anon";
GRANT ALL ON TABLE "public"."finance_paid_payments_v" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_paid_payments_v" TO "service_role";



GRANT ALL ON TABLE "public"."finance_daily_revenue_v" TO "anon";
GRANT ALL ON TABLE "public"."finance_daily_revenue_v" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_daily_revenue_v" TO "service_role";



GRANT ALL ON TABLE "public"."finance_monthly_revenue_v" TO "anon";
GRANT ALL ON TABLE "public"."finance_monthly_revenue_v" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_monthly_revenue_v" TO "service_role";



GRANT ALL ON TABLE "public"."financial_documents" TO "anon";
GRANT ALL ON TABLE "public"."financial_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_documents" TO "service_role";



GRANT ALL ON TABLE "public"."forecast_accuracy" TO "anon";
GRANT ALL ON TABLE "public"."forecast_accuracy" TO "authenticated";
GRANT ALL ON TABLE "public"."forecast_accuracy" TO "service_role";



GRANT ALL ON TABLE "public"."forecast_experiments" TO "anon";
GRANT ALL ON TABLE "public"."forecast_experiments" TO "authenticated";
GRANT ALL ON TABLE "public"."forecast_experiments" TO "service_role";



GRANT ALL ON TABLE "public"."forecast_explanations" TO "anon";
GRANT ALL ON TABLE "public"."forecast_explanations" TO "authenticated";
GRANT ALL ON TABLE "public"."forecast_explanations" TO "service_role";



GRANT ALL ON TABLE "public"."forecast_history" TO "anon";
GRANT ALL ON TABLE "public"."forecast_history" TO "authenticated";
GRANT ALL ON TABLE "public"."forecast_history" TO "service_role";



GRANT ALL ON TABLE "public"."forecast_market_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."forecast_market_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."forecast_market_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."forecast_models" TO "anon";
GRANT ALL ON TABLE "public"."forecast_models" TO "authenticated";
GRANT ALL ON TABLE "public"."forecast_models" TO "service_role";



GRANT ALL ON TABLE "public"."forecast_results" TO "anon";
GRANT ALL ON TABLE "public"."forecast_results" TO "authenticated";
GRANT ALL ON TABLE "public"."forecast_results" TO "service_role";



GRANT ALL ON TABLE "public"."forecast_signal_weights" TO "anon";
GRANT ALL ON TABLE "public"."forecast_signal_weights" TO "authenticated";
GRANT ALL ON TABLE "public"."forecast_signal_weights" TO "service_role";



GRANT ALL ON TABLE "public"."fraud_events" TO "anon";
GRANT ALL ON TABLE "public"."fraud_events" TO "authenticated";
GRANT ALL ON TABLE "public"."fraud_events" TO "service_role";



GRANT ALL ON TABLE "public"."images" TO "anon";
GRANT ALL ON TABLE "public"."images" TO "authenticated";
GRANT ALL ON TABLE "public"."images" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."investigation_history" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."investigation_history" TO "authenticated";
GRANT ALL ON TABLE "public"."investigation_history" TO "service_role";



GRANT ALL ON TABLE "public"."investigation_notes" TO "anon";
GRANT ALL ON TABLE "public"."investigation_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."investigation_notes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."investigation_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."investigation_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."investigation_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."investigations" TO "anon";
GRANT ALL ON TABLE "public"."investigations" TO "authenticated";
GRANT ALL ON TABLE "public"."investigations" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_metadata" TO "anon";
GRANT ALL ON TABLE "public"."invoice_metadata" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_metadata" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."lead_pricing_history" TO "anon";
GRANT ALL ON TABLE "public"."lead_pricing_history" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_pricing_history" TO "service_role";



GRANT ALL ON TABLE "public"."lead_unlock_payments" TO "anon";
GRANT ALL ON TABLE "public"."lead_unlock_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_unlock_payments" TO "service_role";



GRANT ALL ON TABLE "public"."learning_events" TO "anon";
GRANT ALL ON TABLE "public"."learning_events" TO "authenticated";
GRANT ALL ON TABLE "public"."learning_events" TO "service_role";



GRANT ALL ON TABLE "public"."maintenance_contracts" TO "anon";
GRANT ALL ON TABLE "public"."maintenance_contracts" TO "authenticated";
GRANT ALL ON TABLE "public"."maintenance_contracts" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_algorithm_versions" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_algorithm_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_algorithm_versions" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_category_metrics" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_category_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_category_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_decisions" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_decisions" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_decisions" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_executive_reports" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_executive_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_executive_reports" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_heatmaps" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_heatmaps" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_heatmaps" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_intelligence" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_intelligence" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_intelligence" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_knowledge_graph" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_knowledge_graph" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_knowledge_graph" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_notifications" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_offers" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_offers" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_offers" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_opportunities" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_opportunities" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_opportunities" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_recommendations" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_region_metrics" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_region_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_region_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_reports" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_reports" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_request_projections" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_request_projections" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_request_projections" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_selections" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_selections" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_selections" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_simulations" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_simulations" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_simulations" TO "service_role";



GRANT ALL ON TABLE "public"."match_assignments" TO "anon";
GRANT ALL ON TABLE "public"."match_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."match_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."match_pools" TO "anon";
GRANT ALL ON TABLE "public"."match_pools" TO "authenticated";
GRANT ALL ON TABLE "public"."match_pools" TO "service_role";



GRANT ALL ON TABLE "public"."matching_experiments" TO "anon";
GRANT ALL ON TABLE "public"."matching_experiments" TO "authenticated";
GRANT ALL ON TABLE "public"."matching_experiments" TO "service_role";



GRANT ALL ON TABLE "public"."matching_explanations" TO "anon";
GRANT ALL ON TABLE "public"."matching_explanations" TO "authenticated";
GRANT ALL ON TABLE "public"."matching_explanations" TO "service_role";



GRANT ALL ON TABLE "public"."matching_fairness_state" TO "anon";
GRANT ALL ON TABLE "public"."matching_fairness_state" TO "authenticated";
GRANT ALL ON TABLE "public"."matching_fairness_state" TO "service_role";



GRANT ALL ON TABLE "public"."matching_feedback" TO "anon";
GRANT ALL ON TABLE "public"."matching_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."matching_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."matching_history" TO "anon";
GRANT ALL ON TABLE "public"."matching_history" TO "authenticated";
GRANT ALL ON TABLE "public"."matching_history" TO "service_role";



GRANT ALL ON TABLE "public"."matching_scores" TO "anon";
GRANT ALL ON TABLE "public"."matching_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."matching_scores" TO "service_role";



GRANT ALL ON TABLE "public"."matching_weights" TO "anon";
GRANT ALL ON TABLE "public"."matching_weights" TO "authenticated";
GRANT ALL ON TABLE "public"."matching_weights" TO "service_role";



GRANT ALL ON TABLE "public"."media_objects" TO "anon";
GRANT ALL ON TABLE "public"."media_objects" TO "authenticated";
GRANT ALL ON TABLE "public"."media_objects" TO "service_role";



GRANT ALL ON TABLE "public"."media_processing_jobs" TO "anon";
GRANT ALL ON TABLE "public"."media_processing_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."media_processing_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."message_attachments" TO "anon";
GRANT ALL ON TABLE "public"."message_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."message_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."message_read_receipts" TO "anon";
GRANT ALL ON TABLE "public"."message_read_receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."message_read_receipts" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."modules" TO "anon";
GRANT ALL ON TABLE "public"."modules" TO "authenticated";
GRANT ALL ON TABLE "public"."modules" TO "service_role";



GRANT ALL ON TABLE "public"."monetization_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."monetization_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."monetization_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."monetization_billing_settings" TO "anon";
GRANT ALL ON TABLE "public"."monetization_billing_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."monetization_billing_settings" TO "service_role";



GRANT ALL ON TABLE "public"."notification_delivery_attempts" TO "anon";
GRANT ALL ON TABLE "public"."notification_delivery_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_delivery_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."notification_digests" TO "anon";
GRANT ALL ON TABLE "public"."notification_digests" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_digests" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."notification_push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."notification_push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."offer_clarifications" TO "anon";
GRANT ALL ON TABLE "public"."offer_clarifications" TO "authenticated";
GRANT ALL ON TABLE "public"."offer_clarifications" TO "service_role";



GRANT ALL ON TABLE "public"."offer_templates" TO "anon";
GRANT ALL ON TABLE "public"."offer_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."offer_templates" TO "service_role";



GRANT ALL ON TABLE "public"."payment_disputes" TO "anon";
GRANT ALL ON TABLE "public"."payment_disputes" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_disputes" TO "service_role";



GRANT ALL ON TABLE "public"."payment_events" TO "anon";
GRANT ALL ON TABLE "public"."payment_events" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_events" TO "service_role";



GRANT ALL ON TABLE "public"."payment_provider_event_types" TO "anon";
GRANT ALL ON TABLE "public"."payment_provider_event_types" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_provider_event_types" TO "service_role";



GRANT ALL ON TABLE "public"."payment_status_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."payment_status_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_status_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."payment_webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."payment_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."pdf_generation_logs" TO "anon";
GRANT ALL ON TABLE "public"."pdf_generation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."pdf_generation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."platform_alerts" TO "anon";
GRANT ALL ON TABLE "public"."platform_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."platform_anomalies" TO "anon";
GRANT ALL ON TABLE "public"."platform_anomalies" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_anomalies" TO "service_role";



GRANT ALL ON TABLE "public"."platform_health_metrics" TO "anon";
GRANT ALL ON TABLE "public"."platform_health_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_health_metrics" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."platform_ops_audit" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."platform_ops_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_ops_audit" TO "service_role";



GRANT ALL ON TABLE "public"."platform_ops_tasks" TO "anon";
GRANT ALL ON TABLE "public"."platform_ops_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_ops_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."platform_trends" TO "anon";
GRANT ALL ON TABLE "public"."platform_trends" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_trends" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_experiments" TO "anon";
GRANT ALL ON TABLE "public"."pricing_experiments" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_experiments" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_explanations" TO "anon";
GRANT ALL ON TABLE "public"."pricing_explanations" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_explanations" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_feedback" TO "anon";
GRANT ALL ON TABLE "public"."pricing_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_history" TO "anon";
GRANT ALL ON TABLE "public"."pricing_history" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_history" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_market_data" TO "anon";
GRANT ALL ON TABLE "public"."pricing_market_data" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_market_data" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_weights" TO "anon";
GRANT ALL ON TABLE "public"."pricing_weights" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_weights" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."project_activity_events" TO "anon";
GRANT ALL ON TABLE "public"."project_activity_events" TO "authenticated";
GRANT ALL ON TABLE "public"."project_activity_events" TO "service_role";



GRANT ALL ON TABLE "public"."project_approvals" TO "anon";
GRANT ALL ON TABLE "public"."project_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."project_approvals" TO "service_role";



GRANT ALL ON TABLE "public"."project_checklist_items" TO "anon";
GRANT ALL ON TABLE "public"."project_checklist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."project_checklist_items" TO "service_role";



GRANT ALL ON TABLE "public"."project_checklist_templates" TO "anon";
GRANT ALL ON TABLE "public"."project_checklist_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."project_checklist_templates" TO "service_role";



GRANT ALL ON TABLE "public"."project_checklists" TO "anon";
GRANT ALL ON TABLE "public"."project_checklists" TO "authenticated";
GRANT ALL ON TABLE "public"."project_checklists" TO "service_role";



GRANT ALL ON TABLE "public"."project_document_versions" TO "anon";
GRANT ALL ON TABLE "public"."project_document_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."project_document_versions" TO "service_role";



GRANT ALL ON TABLE "public"."project_documents" TO "anon";
GRANT ALL ON TABLE "public"."project_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."project_documents" TO "service_role";



GRANT ALL ON TABLE "public"."project_packages" TO "anon";
GRANT ALL ON TABLE "public"."project_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."project_packages" TO "service_role";



GRANT ALL ON TABLE "public"."project_tasks" TO "anon";
GRANT ALL ON TABLE "public"."project_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."project_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."project_timeline_events" TO "anon";
GRANT ALL ON TABLE "public"."project_timeline_events" TO "authenticated";
GRANT ALL ON TABLE "public"."project_timeline_events" TO "service_role";



GRANT ALL ON TABLE "public"."provider_availability_breaks" TO "anon";
GRANT ALL ON TABLE "public"."provider_availability_breaks" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_availability_breaks" TO "service_role";



GRANT ALL ON TABLE "public"."provider_availability_settings" TO "anon";
GRANT ALL ON TABLE "public"."provider_availability_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_availability_settings" TO "service_role";



GRANT ALL ON TABLE "public"."provider_blocked_times" TO "anon";
GRANT ALL ON TABLE "public"."provider_blocked_times" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_blocked_times" TO "service_role";



GRANT ALL ON TABLE "public"."provider_capacity" TO "anon";
GRANT ALL ON TABLE "public"."provider_capacity" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_capacity" TO "service_role";



GRANT ALL ON TABLE "public"."provider_engagement_events" TO "anon";
GRANT ALL ON TABLE "public"."provider_engagement_events" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_engagement_events" TO "service_role";



GRANT ALL ON TABLE "public"."provider_monetization_plans" TO "anon";
GRANT ALL ON TABLE "public"."provider_monetization_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_monetization_plans" TO "service_role";



GRANT ALL ON TABLE "public"."provider_monthly_unlock_usage" TO "anon";
GRANT ALL ON TABLE "public"."provider_monthly_unlock_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_monthly_unlock_usage" TO "service_role";



GRANT ALL ON TABLE "public"."provider_opportunities" TO "anon";
GRANT ALL ON TABLE "public"."provider_opportunities" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_opportunities" TO "service_role";



GRANT ALL ON TABLE "public"."provider_opportunity_history" TO "anon";
GRANT ALL ON TABLE "public"."provider_opportunity_history" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_opportunity_history" TO "service_role";



GRANT ALL ON TABLE "public"."provider_performance_scores" TO "anon";
GRANT ALL ON TABLE "public"."provider_performance_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_performance_scores" TO "service_role";



GRANT ALL ON TABLE "public"."provider_reputation_scores" TO "anon";
GRANT ALL ON TABLE "public"."provider_reputation_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_reputation_scores" TO "service_role";



GRANT ALL ON TABLE "public"."provider_public_trust" TO "anon";
GRANT ALL ON TABLE "public"."provider_public_trust" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_public_trust" TO "service_role";



GRANT ALL ON TABLE "public"."provider_reputation_cache" TO "anon";
GRANT ALL ON TABLE "public"."provider_reputation_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_reputation_cache" TO "service_role";



GRANT ALL ON TABLE "public"."provider_reputation_events" TO "anon";
GRANT ALL ON TABLE "public"."provider_reputation_events" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_reputation_events" TO "service_role";



GRANT ALL ON TABLE "public"."provider_reputation_explanations" TO "anon";
GRANT ALL ON TABLE "public"."provider_reputation_explanations" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_reputation_explanations" TO "service_role";



GRANT ALL ON TABLE "public"."provider_reputation_history" TO "anon";
GRANT ALL ON TABLE "public"."provider_reputation_history" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_reputation_history" TO "service_role";



GRANT ALL ON TABLE "public"."provider_reputation_signals" TO "anon";
GRANT ALL ON TABLE "public"."provider_reputation_signals" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_reputation_signals" TO "service_role";



GRANT ALL ON TABLE "public"."provider_reputation_weights" TO "anon";
GRANT ALL ON TABLE "public"."provider_reputation_weights" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_reputation_weights" TO "service_role";



GRANT ALL ON TABLE "public"."provider_request_settings" TO "anon";
GRANT ALL ON TABLE "public"."provider_request_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_request_settings" TO "service_role";



GRANT ALL ON TABLE "public"."service_reviews" TO "anon";
GRANT ALL ON TABLE "public"."service_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."service_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."provider_reviews" TO "anon";
GRANT ALL ON TABLE "public"."provider_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."provider_routes" TO "anon";
GRANT ALL ON TABLE "public"."provider_routes" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_routes" TO "service_role";



GRANT ALL ON TABLE "public"."provider_schedule_gaps" TO "anon";
GRANT ALL ON TABLE "public"."provider_schedule_gaps" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_schedule_gaps" TO "service_role";



GRANT ALL ON TABLE "public"."provider_services" TO "anon";
GRANT ALL ON TABLE "public"."provider_services" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_services" TO "service_role";



GRANT ALL ON TABLE "public"."provider_verification_checks" TO "anon";
GRANT ALL ON TABLE "public"."provider_verification_checks" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_verification_checks" TO "service_role";



GRANT ALL ON TABLE "public"."provider_verifications" TO "anon";
GRANT ALL ON TABLE "public"."provider_verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_verifications" TO "service_role";



GRANT ALL ON TABLE "public"."provider_working_hours" TO "anon";
GRANT ALL ON TABLE "public"."provider_working_hours" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_working_hours" TO "service_role";



GRANT ALL ON TABLE "public"."providers" TO "anon";
GRANT ALL ON TABLE "public"."providers" TO "authenticated";
GRANT ALL ON TABLE "public"."providers" TO "service_role";



GRANT ALL ON TABLE "public"."quality_case_ai_analysis" TO "anon";
GRANT ALL ON TABLE "public"."quality_case_ai_analysis" TO "authenticated";
GRANT ALL ON TABLE "public"."quality_case_ai_analysis" TO "service_role";



GRANT ALL ON TABLE "public"."quality_case_assignments" TO "anon";
GRANT ALL ON TABLE "public"."quality_case_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."quality_case_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."quality_case_evidence" TO "anon";
GRANT ALL ON TABLE "public"."quality_case_evidence" TO "authenticated";
GRANT ALL ON TABLE "public"."quality_case_evidence" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."quality_case_history" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."quality_case_history" TO "authenticated";
GRANT ALL ON TABLE "public"."quality_case_history" TO "service_role";



GRANT ALL ON TABLE "public"."quality_case_messages" TO "anon";
GRANT ALL ON TABLE "public"."quality_case_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."quality_case_messages" TO "service_role";



GRANT ALL ON TABLE "public"."quality_case_metrics" TO "anon";
GRANT ALL ON TABLE "public"."quality_case_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."quality_case_metrics" TO "service_role";



GRANT ALL ON SEQUENCE "public"."quality_case_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."quality_case_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."quality_case_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."quality_cases" TO "anon";
GRANT ALL ON TABLE "public"."quality_cases" TO "authenticated";
GRANT ALL ON TABLE "public"."quality_cases" TO "service_role";



GRANT ALL ON TABLE "public"."quote_items" TO "anon";
GRANT ALL ON TABLE "public"."quote_items" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_items" TO "service_role";



GRANT ALL ON TABLE "public"."quotes" TO "anon";
GRANT ALL ON TABLE "public"."quotes" TO "authenticated";
GRANT ALL ON TABLE "public"."quotes" TO "service_role";



GRANT ALL ON TABLE "public"."receipt_metadata" TO "anon";
GRANT ALL ON TABLE "public"."receipt_metadata" TO "authenticated";
GRANT ALL ON TABLE "public"."receipt_metadata" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_plans" TO "anon";
GRANT ALL ON TABLE "public"."recurring_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_plans" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_recommendations" TO "anon";
GRANT ALL ON TABLE "public"."recurring_recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_reminder_log" TO "anon";
GRANT ALL ON TABLE "public"."recurring_reminder_log" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_reminder_log" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_visits" TO "anon";
GRANT ALL ON TABLE "public"."recurring_visits" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_visits" TO "service_role";



GRANT ALL ON TABLE "public"."refund_history" TO "anon";
GRANT ALL ON TABLE "public"."refund_history" TO "authenticated";
GRANT ALL ON TABLE "public"."refund_history" TO "service_role";



GRANT ALL ON TABLE "public"."refund_requests" TO "anon";
GRANT ALL ON TABLE "public"."refund_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."refund_requests" TO "service_role";



GRANT ALL ON TABLE "public"."region_health" TO "anon";
GRANT ALL ON TABLE "public"."region_health" TO "authenticated";
GRANT ALL ON TABLE "public"."region_health" TO "service_role";



GRANT ALL ON TABLE "public"."review_ai_analysis" TO "anon";
GRANT ALL ON TABLE "public"."review_ai_analysis" TO "authenticated";
GRANT ALL ON TABLE "public"."review_ai_analysis" TO "service_role";



GRANT ALL ON TABLE "public"."review_flags" TO "anon";
GRANT ALL ON TABLE "public"."review_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."review_flags" TO "service_role";



GRANT ALL ON TABLE "public"."service_review_helpful_votes" TO "anon";
GRANT ALL ON TABLE "public"."service_review_helpful_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."service_review_helpful_votes" TO "service_role";



GRANT ALL ON TABLE "public"."review_helpfulness" TO "anon";
GRANT ALL ON TABLE "public"."review_helpfulness" TO "authenticated";
GRANT ALL ON TABLE "public"."review_helpfulness" TO "service_role";



GRANT ALL ON TABLE "public"."review_media" TO "anon";
GRANT ALL ON TABLE "public"."review_media" TO "authenticated";
GRANT ALL ON TABLE "public"."review_media" TO "service_role";



GRANT ALL ON TABLE "public"."review_moderation" TO "anon";
GRANT ALL ON TABLE "public"."review_moderation" TO "authenticated";
GRANT ALL ON TABLE "public"."review_moderation" TO "service_role";



GRANT ALL ON TABLE "public"."review_ratings" TO "anon";
GRANT ALL ON TABLE "public"."review_ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."review_ratings" TO "service_role";



GRANT ALL ON TABLE "public"."review_responses" TO "anon";
GRANT ALL ON TABLE "public"."review_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."review_responses" TO "service_role";



GRANT ALL ON TABLE "public"."review_settings" TO "anon";
GRANT ALL ON TABLE "public"."review_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."review_settings" TO "service_role";



GRANT ALL ON TABLE "public"."risk_rules" TO "anon";
GRANT ALL ON TABLE "public"."risk_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."risk_rules" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."risk_score_history" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."risk_score_history" TO "authenticated";
GRANT ALL ON TABLE "public"."risk_score_history" TO "service_role";



GRANT ALL ON TABLE "public"."risk_scores" TO "anon";
GRANT ALL ON TABLE "public"."risk_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."risk_scores" TO "service_role";



GRANT ALL ON TABLE "public"."route_optimization_cache" TO "anon";
GRANT ALL ON TABLE "public"."route_optimization_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."route_optimization_cache" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_experiments" TO "anon";
GRANT ALL ON TABLE "public"."schedule_experiments" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_experiments" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_explanations" TO "anon";
GRANT ALL ON TABLE "public"."schedule_explanations" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_explanations" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_history" TO "anon";
GRANT ALL ON TABLE "public"."schedule_history" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_history" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_profiles" TO "anon";
GRANT ALL ON TABLE "public"."schedule_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_recommendations" TO "anon";
GRANT ALL ON TABLE "public"."schedule_recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_signal_weights" TO "anon";
GRANT ALL ON TABLE "public"."schedule_signal_weights" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_signal_weights" TO "service_role";



GRANT ALL ON TABLE "public"."search_logs" TO "anon";
GRANT ALL ON TABLE "public"."search_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."search_logs" TO "service_role";



GRANT ALL ON TABLE "public"."service_projects" TO "anon";
GRANT ALL ON TABLE "public"."service_projects" TO "authenticated";
GRANT ALL ON TABLE "public"."service_projects" TO "service_role";



GRANT ALL ON TABLE "public"."service_request_images" TO "anon";
GRANT ALL ON TABLE "public"."service_request_images" TO "authenticated";
GRANT ALL ON TABLE "public"."service_request_images" TO "service_role";



GRANT ALL ON TABLE "public"."service_requests" TO "anon";
GRANT ALL ON TABLE "public"."service_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."service_requests" TO "service_role";



GRANT ALL ON TABLE "public"."service_review_images" TO "anon";
GRANT ALL ON TABLE "public"."service_review_images" TO "authenticated";
GRANT ALL ON TABLE "public"."service_review_images" TO "service_role";



GRANT ALL ON TABLE "public"."smart_notifications" TO "anon";
GRANT ALL ON TABLE "public"."smart_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."smart_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_plans" TO "anon";
GRANT ALL ON TABLE "public"."subscription_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_plans" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."unlock_reliability_signals" TO "anon";
GRANT ALL ON TABLE "public"."unlock_reliability_signals" TO "authenticated";
GRANT ALL ON TABLE "public"."unlock_reliability_signals" TO "service_role";



GRANT ALL ON TABLE "public"."unlock_sessions" TO "anon";
GRANT ALL ON TABLE "public"."unlock_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."unlock_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."user_presence" TO "anon";
GRANT ALL ON TABLE "public"."user_presence" TO "authenticated";
GRANT ALL ON TABLE "public"."user_presence" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_storage_usage" TO "anon";
GRANT ALL ON TABLE "public"."user_storage_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."user_storage_usage" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."verification_levels" TO "anon";
GRANT ALL ON TABLE "public"."verification_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."verification_levels" TO "service_role";



GRANT ALL ON TABLE "public"."verification_types" TO "anon";
GRANT ALL ON TABLE "public"."verification_types" TO "authenticated";
GRANT ALL ON TABLE "public"."verification_types" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

































-- =============================================================================
-- Storage buckets (reference configuration; platform storage schema assumed)
-- Extracted from archived migrations — idempotent where ON CONFLICT present.
-- =============================================================================
-- from archive/20260713140000_provider_management.sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'provider-media',
  'provider-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- from archive/20260714140000_provider_verifications.sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'provider-verification',
  'provider-verification',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- from archive/20260716120000_payment_flow_simplify.sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-receipts',
  'payment-receipts',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- from archive/20260717140000_sprint21_service_requests.sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-request-media',
  'service-request-media',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- from archive/20260720110000_repair_marketplace_service_requests_schema.sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-request-media',
  'service-request-media',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- from archive/20260723200000_sprint36_chat_platform.sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  false,
  10485760,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- from archive/20260723210000_sprint37_booking_platform.sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'booking-attachments',
  'booking-attachments',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- from archive/20260726190000_sprint5_file_media.sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  false,
  52428800,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip', 'application/x-zip-compressed',
    'text/plain', 'text/csv',
    'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-m4a',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public = false;

-- from archive/20260726190000_sprint5_file_media.sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-media',
  'project-media',
  false,
  52428800,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip', 'application/x-zip-compressed',
    'text/plain', 'text/csv',
    'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public = false;

-- from archive/20260727040000_sprint6_financial_documents.sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'financial-documents',
  'financial-documents',
  false,
  10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

