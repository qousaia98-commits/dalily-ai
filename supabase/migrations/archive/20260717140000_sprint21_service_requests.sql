-- Sprint 21 — Service Request Workflow (Request → Accept → Chat)

-- =============================================================================
-- ENUMS
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_request_status') THEN
    CREATE TYPE public.service_request_status AS ENUM (
      'pending',
      'accepted',
      'rejected',
      'cancelled'
    );
  END IF;
END $$;

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
