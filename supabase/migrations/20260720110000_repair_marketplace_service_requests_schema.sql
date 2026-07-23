-- =============================================================================
-- REPAIR: Marketplace schema (Sprint 21–23) — must run BEFORE Sprint 29
-- =============================================================================
-- Diagnosis (remote, PostgREST PGRST205):
--   - schema_migrations marks 20260717140000 / 150000 / 160000 as applied
--   - but marketplace tables (service_requests, quotes, conversations, …) are missing
-- Root cause: history marked applied without matching schema
--   (e.g. `supabase migration repair --status applied` after a failed push).
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

-- >>> BEGIN replay of 20260717140000_sprint21_service_requests.sql
-- Sprint 21 — Service Request Workflow (Request → Accept → Chat)

-- ENUM bootstrap handled at top of repair (full Sprint 21–22 value set).

-- =============================================================================
-- CONVERSATIONS (created only after request is accepted)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers (id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  service_request_id UUID UNIQUE,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversations_provider_idx
  ON public.conversations (provider_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS conversations_customer_idx
  ON public.conversations (customer_id, last_message_at DESC);

-- =============================================================================
-- SERVICE REQUESTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.providers (id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  preferred_date DATE,
  preferred_time TIME,
  budget NUMERIC(12, 2),
  location_text TEXT,
  status public.service_request_status NOT NULL DEFAULT 'pending',
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_requests_budget_nonneg CHECK (budget IS NULL OR budget >= 0)
);

CREATE INDEX IF NOT EXISTS service_requests_provider_status_idx
  ON public.service_requests (provider_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS service_requests_customer_idx
  ON public.service_requests (customer_id, created_at DESC);

-- One open pending request per customer ↔ provider pair
CREATE UNIQUE INDEX IF NOT EXISTS service_requests_one_pending_per_pair
  ON public.service_requests (customer_id, provider_id)
  WHERE status = 'pending';

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_service_request_id_fkey;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_service_request_id_fkey
  FOREIGN KEY (service_request_id) REFERENCES public.service_requests (id) ON DELETE SET NULL;

-- =============================================================================
-- REQUEST PHOTOS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.service_request_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.service_requests (id) ON DELETE CASCADE,
  bucket VARCHAR(100) NOT NULL DEFAULT 'service-request-media',
  path TEXT NOT NULL,
  mime_type VARCHAR(100),
  size_bytes INTEGER,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bucket, path)
);

CREATE INDEX IF NOT EXISTS service_request_images_request_idx
  ON public.service_request_images (request_id, sort_order);

-- =============================================================================
-- MESSAGES (chat after acceptance)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  body_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT messages_body_not_empty CHECK (char_length(trim(body_text)) > 0)
);

CREATE INDEX IF NOT EXISTS messages_conversation_idx
  ON public.messages (conversation_id, created_at ASC);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

DROP TRIGGER IF EXISTS service_requests_updated_at ON public.service_requests;
CREATE TRIGGER service_requests_updated_at
  BEFORE UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS conversations_updated_at ON public.conversations;
CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.touch_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS messages_touch_conversation ON public.messages;
CREATE TRIGGER messages_touch_conversation
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_conversation_last_message();

-- =============================================================================
-- ACCEPT / REJECT (atomic)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.accept_service_request(
  p_request_id UUID,
  p_actor_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  SET status = 'accepted', accepted_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.conversations (provider_id, customer_id, service_request_id)
  VALUES (v_request.provider_id, v_request.customer_id, p_request_id)
  RETURNING id INTO v_conversation_id;

  v_summary := trim(v_request.title) || E'\n\n' || trim(v_request.description);

  INSERT INTO public.messages (conversation_id, sender_id, body_text)
  VALUES (v_conversation_id, p_actor_id, v_summary);

  RETURN v_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_service_request(
  p_request_id UUID,
  p_actor_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  SET status = 'rejected', rejected_at = now()
  WHERE id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_service_request(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_service_request(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_service_request(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_service_request(UUID, UUID) TO authenticated;

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_request_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_requests_customer_insert" ON public.service_requests;
CREATE POLICY "service_requests_customer_insert" ON public.service_requests
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "service_requests_customer_select" ON public.service_requests;
CREATE POLICY "service_requests_customer_select" ON public.service_requests
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "service_requests_customer_cancel" ON public.service_requests;
CREATE POLICY "service_requests_customer_cancel" ON public.service_requests
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid() AND status = 'pending')
  WITH CHECK (customer_id = auth.uid() AND status = 'cancelled');

DROP POLICY IF EXISTS "service_requests_provider_select" ON public.service_requests;
CREATE POLICY "service_requests_provider_select" ON public.service_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = service_requests.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "service_requests_admin_select" ON public.service_requests;
CREATE POLICY "service_requests_admin_select" ON public.service_requests
  FOR SELECT TO authenticated
  USING (public.has_role('admin') OR public.has_role('moderator'));

DROP POLICY IF EXISTS "service_request_images_customer_insert" ON public.service_request_images;
CREATE POLICY "service_request_images_customer_insert" ON public.service_request_images
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = service_request_images.request_id
        AND sr.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "service_request_images_participant_select" ON public.service_request_images;
CREATE POLICY "service_request_images_participant_select" ON public.service_request_images
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = service_request_images.request_id
        AND (
          sr.customer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.providers p
            WHERE p.id = sr.provider_id AND p.owner_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "conversations_participant_select" ON public.conversations;
CREATE POLICY "conversations_participant_select" ON public.conversations
  FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = conversations.provider_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_participant_select" ON public.messages;
CREATE POLICY "messages_participant_select" ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.customer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.providers p
            WHERE p.id = c.provider_id AND p.owner_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "messages_participant_insert" ON public.messages;
CREATE POLICY "messages_participant_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.service_requests sr ON sr.id = c.service_request_id
      WHERE c.id = messages.conversation_id
        AND sr.status = 'accepted'
        AND (
          c.customer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.providers p
            WHERE p.id = c.provider_id AND p.owner_id = auth.uid()
          )
        )
    )
  );

-- =============================================================================
-- STORAGE (request photos)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-request-media',
  'service-request-media',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "service_request_media_customer_insert" ON storage.objects;
CREATE POLICY "service_request_media_customer_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'service-request-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "service_request_media_participant_select" ON storage.objects;
CREATE POLICY "service_request_media_participant_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'service-request-media'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role('admin')
      OR public.has_role('moderator')
    )
  );

-- <<< END replay of 20260717140000_sprint21_service_requests.sql

-- >>> BEGIN replay of 20260717150000_sprint22_marketplace_workflow.sql
-- Sprint 22 — Complete Service Marketplace Workflow

-- =============================================================================
-- EXTEND service_request_status ENUM
-- =============================================================================

DO $$
BEGIN
  ALTER TYPE public.service_request_status ADD VALUE IF NOT EXISTS 'quoted';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.service_request_status ADD VALUE IF NOT EXISTS 'quote_accepted';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.service_request_status ADD VALUE IF NOT EXISTS 'quote_declined';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.service_request_status ADD VALUE IF NOT EXISTS 'in_progress';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.service_request_status ADD VALUE IF NOT EXISTS 'completed_by_business';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.service_request_status ADD VALUE IF NOT EXISTS 'completed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.service_request_status ADD VALUE IF NOT EXISTS 'disputed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.service_request_status ADD VALUE IF NOT EXISTS 'reviewed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- EXTEND service_requests
-- =============================================================================

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS quoted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quote_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quote_declined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS in_progress_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_by_business_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_note TEXT,
  ADD COLUMN IF NOT EXISTS response_time_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS completion_time_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS currency VARCHAR(8) DEFAULT 'SYP';

-- =============================================================================
-- QUOTES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES public.service_requests (id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.providers (id) ON DELETE CASCADE,
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  currency VARCHAR(8) NOT NULL DEFAULT 'SYP',
  estimated_duration_text VARCHAR(120),
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'accepted', 'declined', 'changes_requested', 'superseded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS quotes_request_idx
  ON public.quotes (service_request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes (id) ON DELETE CASCADE,
  label VARCHAR(200) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_items_quote_idx
  ON public.quote_items (quote_id, sort_order);

DROP TRIGGER IF EXISTS quotes_updated_at ON public.quotes;
CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- REVIEWS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.service_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL UNIQUE REFERENCES public.service_requests (id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.providers (id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  recommend BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_reviews_provider_idx
  ON public.service_reviews (provider_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.service_review_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.service_reviews (id) ON DELETE CASCADE,
  bucket VARCHAR(100) NOT NULL DEFAULT 'service-request-media',
  path TEXT NOT NULL,
  mime_type VARCHAR(100),
  size_bytes INTEGER,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bucket, path)
);

-- =============================================================================
-- MESSAGES: system flag
-- =============================================================================

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(40);

-- Allow system messages without a real sender constraint change:
-- system messages still need a sender_id (actor who triggered). Keep as-is.

-- =============================================================================
-- BUSINESS REQUEST SETTINGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.provider_request_settings (
  provider_id UUID PRIMARY KEY REFERENCES public.providers (id) ON DELETE CASCADE,
  accepting_requests BOOLEAN NOT NULL DEFAULT true,
  max_pending_requests SMALLINT NOT NULL DEFAULT 50 CHECK (max_pending_requests BETWEEN 1 AND 200),
  auto_reject_message TEXT,
  vacation_mode BOOLEAN NOT NULL DEFAULT false,
  estimated_response_hours SMALLINT NOT NULL DEFAULT 24 CHECK (estimated_response_hours BETWEEN 1 AND 168),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS provider_request_settings_updated_at ON public.provider_request_settings;
CREATE TRIGGER provider_request_settings_updated_at
  BEFORE UPDATE ON public.provider_request_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- MARKETPLACE NOTIFICATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  type VARCHAR(60) NOT NULL,
  title_key VARCHAR(120) NOT NULL,
  body_key VARCHAR(120) NOT NULL,
  body_params JSONB NOT NULL DEFAULT '{}',
  href TEXT,
  service_request_id UUID REFERENCES public.service_requests (id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations (id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketplace_notifications_user_unread_idx
  ON public.marketplace_notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS marketplace_notifications_user_idx
  ON public.marketplace_notifications (user_id, created_at DESC);

-- =============================================================================
-- HELPERS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.post_system_message(
  p_conversation_id UUID,
  p_actor_id UUID,
  p_body TEXT,
  p_event_type VARCHAR(40)
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.messages (conversation_id, sender_id, body_text, is_system, event_type)
  VALUES (p_conversation_id, p_actor_id, p_body, true, p_event_type)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_marketplace_user(
  p_user_id UUID,
  p_type VARCHAR(60),
  p_title_key VARCHAR(120),
  p_body_key VARCHAR(120),
  p_body_params JSONB DEFAULT '{}',
  p_href TEXT DEFAULT NULL,
  p_request_id UUID DEFAULT NULL,
  p_conversation_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
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

-- Update accept to set response_time + notify + system message
CREATE OR REPLACE FUNCTION public.accept_service_request(
  p_request_id UUID,
  p_actor_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.reject_service_request(
  p_request_id UUID,
  p_actor_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_review_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_request_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotes_participant_select" ON public.quotes;
CREATE POLICY "quotes_participant_select" ON public.quotes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = quotes.service_request_id
        AND (
          sr.customer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.providers p
            WHERE p.id = sr.provider_id AND p.owner_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "quotes_provider_insert" ON public.quotes;
CREATE POLICY "quotes_provider_insert" ON public.quotes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = quotes.provider_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "quotes_participant_update" ON public.quotes;
CREATE POLICY "quotes_participant_update" ON public.quotes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = quotes.service_request_id
        AND (
          sr.customer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.providers p
            WHERE p.id = sr.provider_id AND p.owner_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "quote_items_participant_select" ON public.quote_items;
CREATE POLICY "quote_items_participant_select" ON public.quote_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      JOIN public.service_requests sr ON sr.id = q.service_request_id
      WHERE q.id = quote_items.quote_id
        AND (
          sr.customer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.providers p
            WHERE p.id = sr.provider_id AND p.owner_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "quote_items_provider_insert" ON public.quote_items;
CREATE POLICY "quote_items_provider_insert" ON public.quote_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotes q
      JOIN public.providers p ON p.id = q.provider_id
      WHERE q.id = quote_items.quote_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "service_reviews_select" ON public.service_reviews;
CREATE POLICY "service_reviews_select" ON public.service_reviews
  FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = service_reviews.provider_id AND p.owner_id = auth.uid()
    )
    OR public.has_role('admin')
    OR public.has_role('moderator')
  );

DROP POLICY IF EXISTS "service_reviews_customer_insert" ON public.service_reviews;
CREATE POLICY "service_reviews_customer_insert" ON public.service_reviews
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "service_review_images_select" ON public.service_review_images;
CREATE POLICY "service_review_images_select" ON public.service_review_images
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_reviews r
      WHERE r.id = service_review_images.review_id
        AND (
          r.customer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.providers p
            WHERE p.id = r.provider_id AND p.owner_id = auth.uid()
          )
          OR public.has_role('admin')
        )
    )
  );

DROP POLICY IF EXISTS "service_review_images_insert" ON public.service_review_images;
CREATE POLICY "service_review_images_insert" ON public.service_review_images
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_reviews r
      WHERE r.id = service_review_images.review_id AND r.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "provider_request_settings_owner" ON public.provider_request_settings;
CREATE POLICY "provider_request_settings_owner" ON public.provider_request_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_request_settings.provider_id AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_request_settings.provider_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "provider_request_settings_public_select" ON public.provider_request_settings;
CREATE POLICY "provider_request_settings_public_select" ON public.provider_request_settings
  FOR SELECT TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "marketplace_notifications_own" ON public.marketplace_notifications;
CREATE POLICY "marketplace_notifications_own" ON public.marketplace_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "marketplace_notifications_own_update" ON public.marketplace_notifications;
CREATE POLICY "marketplace_notifications_own_update" ON public.marketplace_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Broaden service_requests update for lifecycle transitions (customer + provider)
DROP POLICY IF EXISTS "service_requests_customer_cancel" ON public.service_requests;
DROP POLICY IF EXISTS "service_requests_customer_update" ON public.service_requests;
CREATE POLICY "service_requests_customer_update" ON public.service_requests
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "service_requests_provider_update" ON public.service_requests;
CREATE POLICY "service_requests_provider_update" ON public.service_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = service_requests.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = service_requests.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "service_requests_admin_select" ON public.service_requests;
CREATE POLICY "service_requests_admin_select" ON public.service_requests
  FOR SELECT TO authenticated
  USING (public.has_role('admin') OR public.has_role('moderator'));

-- Chat unlock: accepted and later active statuses
DROP POLICY IF EXISTS "messages_participant_insert" ON public.messages;
CREATE POLICY "messages_participant_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.service_requests sr ON sr.id = c.service_request_id
      WHERE c.id = messages.conversation_id
        AND sr.status IN (
          'accepted', 'quoted', 'quote_accepted', 'quote_declined',
          'in_progress', 'completed_by_business', 'completed', 'disputed'
        )
        AND sr.status <> 'reviewed'
        AND (
          c.customer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.providers p
            WHERE p.id = c.provider_id AND p.owner_id = auth.uid()
          )
        )
    )
  );

-- Realtime publication
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.service_requests;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT EXECUTE ON FUNCTION public.post_system_message(UUID, UUID, TEXT, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_marketplace_user(UUID, VARCHAR, VARCHAR, VARCHAR, JSONB, TEXT, UUID, UUID) TO authenticated;

-- <<< END replay of 20260717150000_sprint22_marketplace_workflow.sql

-- >>> BEGIN replay of 20260717160000_sprint23_qa_hardening.sql
-- Sprint 23 QA hardening: status transitions, review gate, RPC authz,
-- quote ownership, request-media storage for providers.

-- =============================================================================
-- Status transition enforcement (blocks client-side status bypass via RLS)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.service_request_transition_allowed(
  p_old public.service_request_status,
  p_new public.service_request_status
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
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

CREATE OR REPLACE FUNCTION public.enforce_service_request_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS trg_service_request_status_transition ON public.service_requests;
CREATE TRIGGER trg_service_request_status_transition
  BEFORE UPDATE OF status ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_service_request_status_transition();

-- =============================================================================
-- Reviews only after completed + matching ownership
-- =============================================================================

DROP POLICY IF EXISTS "service_reviews_customer_insert" ON public.service_reviews;
CREATE POLICY "service_reviews_customer_insert" ON public.service_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = service_reviews.service_request_id
        AND sr.customer_id = auth.uid()
        AND sr.provider_id = service_reviews.provider_id
        AND sr.status = 'completed'
    )
  );

-- =============================================================================
-- Quotes must belong to the request's provider
-- =============================================================================

DROP POLICY IF EXISTS "quotes_provider_insert" ON public.quotes;
CREATE POLICY "quotes_provider_insert" ON public.quotes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.providers p
      JOIN public.service_requests sr ON sr.id = quotes.service_request_id
      WHERE p.id = quotes.provider_id
        AND p.id = sr.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );

-- =============================================================================
-- RPC helpers: require actor is participant / caller
-- =============================================================================

CREATE OR REPLACE FUNCTION public.post_system_message(
  p_conversation_id UUID,
  p_actor_id UUID,
  p_body TEXT,
  p_event_type VARCHAR(40)
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.notify_marketplace_user(
  p_user_id UUID,
  p_type VARCHAR(60),
  p_title_key VARCHAR(120),
  p_body_key VARCHAR(120),
  p_body_params JSONB DEFAULT '{}',
  p_href TEXT DEFAULT NULL,
  p_request_id UUID DEFAULT NULL,
  p_conversation_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- =============================================================================
-- Request media: providers can read photos for their requests
-- =============================================================================

DROP POLICY IF EXISTS "service_request_media_participant_select" ON storage.objects;
CREATE POLICY "service_request_media_participant_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'service-request-media'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role('admin')
      OR public.has_role('moderator')
      OR EXISTS (
        SELECT 1
        FROM public.service_request_images sri
        JOIN public.service_requests sr ON sr.id = sri.request_id
        JOIN public.providers p ON p.id = sr.provider_id
        WHERE sri.bucket = 'service-request-media'
          AND sri.path = storage.objects.name
          AND p.owner_id = auth.uid()
          AND p.deleted_at IS NULL
      )
    )
  );

-- <<< END replay of 20260717160000_sprint23_qa_hardening.sql

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
