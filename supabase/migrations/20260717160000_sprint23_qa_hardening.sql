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
          AND sri.path = name
          AND p.owner_id = auth.uid()
          AND p.deleted_at IS NULL
      )
    )
  );
