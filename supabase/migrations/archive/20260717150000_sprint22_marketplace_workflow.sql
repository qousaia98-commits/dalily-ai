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
